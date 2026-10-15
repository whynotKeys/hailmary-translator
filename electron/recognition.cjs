const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");

function registerRecognitionIPC({ ipcMain, app, checkSender, readMappings }) {
  let worker = null;
  let starting = null;
  let stdoutBuffer = "";

  const pending = new Map();

  function workerPaths() {
    const projectRoot = path.join(__dirname, "..");

    if (app.isPackaged) {
      return {
        executable: path.join(
          process.resourcesPath,
          "recognition-worker",
          "recognition-worker.exe",
        ),
        args: [],
        modelDir: path.join(process.resourcesPath, "models", "whisper-small"),
      };
    }

    return {
      executable:
        process.platform === "win32"
          ? path.join(projectRoot, "python", ".venv", "Scripts", "python.exe")
          : path.join(projectRoot, "python", ".venv", "bin", "python"),
      args: ["-u", path.join(projectRoot, "python", "worker.py")],
      modelDir: path.join(projectRoot, "models", "whisper-small"),
    };
  }

  function rejectPending(message) {
    for (const item of pending.values()) {
      clearTimeout(item.timeout);
      item.reject(new Error(message));
    }

    pending.clear();
  }

  function processWorkerLine(line, onReady) {
    let message;

    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.type === "ready") {
      onReady();
      return;
    }

    const request = pending.get(message.requestId);
    if (!request) return;

    clearTimeout(request.timeout);
    pending.delete(message.requestId);

    if (message.ok) {
      request.resolve(message.result);
    } else {
      request.reject(new Error(message.error || "인식 엔진 오류"));
    }
  }

  function startWorker() {
    // 시작 중이라면 ready 응답을 기다림
    if (starting) return starting;

    if (worker && !worker.killed) {
      return Promise.resolve();
    }

    starting = new Promise((resolve, reject) => {
      const config = workerPaths();

      let settled = false;
      let timeout;

      function ready() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        starting = null;
        resolve();
      }

      function fail(message) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        starting = null;
        reject(new Error(message));
      }

      const child = spawn(config.executable, config.args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...process.env,
          MODEL_DIR: config.modelDir,
          HF_HUB_OFFLINE: "1",

          PYTHONIOENCODING: "utf-8", // Python 표준 입출력을 UTF-8로 고정
          PYTHONUTF8: "1",
        },
      });

      worker = child;
      stdoutBuffer = "";

      child.stdout.setEncoding("utf8");

      child.stdout.on("data", (chunk) => {
        stdoutBuffer += chunk;

        let newline;

        while ((newline = stdoutBuffer.indexOf("\n")) !== -1) {
          const line = stdoutBuffer.slice(0, newline).trim();
          stdoutBuffer = stdoutBuffer.slice(newline + 1);

          processWorkerLine(line, ready);
        }
      });

      child.stderr.on("data", (chunk) => {
        console.error("[recognition]", String(chunk));
      });

      child.on("error", (error) => {
        if (worker === child) worker = null;
        fail(`Python 실행 실패: ${error.message}`);
        rejectPending("인식 엔진 실행에 실패했습니다.");
      });

      child.on("exit", (code) => {
        if (worker === child) worker = null;

        fail(`인식 엔진이 종료되었습니다. 종료 코드: ${code}`);
        rejectPending("인식 엔진이 종료되었습니다.");
      });

      timeout = setTimeout(() => {
        child.kill();
        fail("인식 엔진 실행 시간이 초과되었습니다.");
      }, 60000);
    });

    return starting;
  }

  async function requestWorker(kind, wavPath, references = []) {
    await startWorker();

    if (!worker || !worker.stdin.writable) {
      throw new Error("인식 엔진이 준비되지 않았습니다.");
    }

    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          pending.delete(requestId);
          reject(new Error("인식 시간이 초과되었습니다."));
        },
        kind === "stt" ? 180000 : 120000,
      );

      pending.set(requestId, {
        resolve,
        reject,
        timeout,
      });

      const data = JSON.stringify({
        requestId,
        kind,
        wavPath,
        references,
      });

      worker.stdin.write(data + "\n", (error) => {
        if (!error) return;

        const item = pending.get(requestId);

        if (item) {
          clearTimeout(item.timeout);
          pending.delete(requestId);
          reject(error);
        }
      });
    });
  }

  function toBuffer(value, maxSize) {
    if (!Array.isArray(value) || value.length > maxSize) {
      throw new Error("오디오 데이터 크기가 올바르지 않습니다.");
    }

    if (!value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      throw new Error("오디오 데이터 형식이 올바르지 않습니다.");
    }

    const buffer = Buffer.from(value);

    if (
      buffer.length < 44 ||
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WAVE"
    ) {
      throw new Error("올바른 WAV 파일이 아닙니다.");
    }

    return buffer;
  }

  async function withTempDir(callback) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sound-recognition-"));

    try {
      return await callback(dir);
    } finally {
      await fs.rm(dir, {
        recursive: true,
        force: true,
      });
    }
  }

  ipcMain.handle("recognition:stt", async (event, wavBytes) => {
    checkSender(event);

    return withTempDir(async (dir) => {
      const wav = toBuffer(wavBytes, 20 * 1024 * 1024);
      const wavPath = path.join(dir, "input.wav");

      await fs.writeFile(wavPath, wav);

      return requestWorker("stt", wavPath);
    });
  });

  ipcMain.handle("recognition:match", async (event, payload) => {
    checkSender(event);

    if (
      !payload ||
      !Array.isArray(payload.references) ||
      payload.references.length === 0 ||
      payload.references.length > 30
    ) {
      throw new Error("비교할 사운드는 1~30개여야 합니다.");
    }

    const mappings = await readMappings();
    const validIds = new Set(mappings.map((item) => item.id));
    const usedIds = new Set();

    return withTempDir(async (dir) => {
      const wav = toBuffer(payload.wavBytes, 1 * 1024 * 1024);

      const wavPath = path.join(dir, "input.wav");
      await fs.writeFile(wavPath, wav);

      const references = [];

      for (let i = 0; i < payload.references.length; i++) {
        const item = payload.references[i];

        if (
          typeof item.id !== "string" ||
          !validIds.has(item.id) ||
          usedIds.has(item.id)
        ) {
          throw new Error("잘못된 비교 대상 ID입니다.");
        }

        usedIds.add(item.id);

        const bytes = toBuffer(item.wavBytes, 1 * 1024 * 1024);

        const filePath = path.join(dir, `reference-${i}.wav`);

        await fs.writeFile(filePath, bytes);

        references.push({
          id: item.id,
          wavPath: filePath,
        });
      }

      return requestWorker("match", wavPath, references);
    });
  });

  app.on("before-quit", () => {
    if (worker) {
      worker.kill();
      worker = null;
    }
  });
}

module.exports = { registerRecognitionIPC };
