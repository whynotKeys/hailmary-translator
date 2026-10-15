const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const http = require("node:http");
const serveHandler = require("serve-handler");

const isDev = !app.isPackaged;
const MAX_BYTES = 10 * 1024 * 1024;

let mainWindow = null;
let staticServer = null;

function getPaths() {
  const root = path.join(app.getPath("userData"), "sound-data");

  return {
    root,
    sounds: path.join(root, "sounds"),
    mappings: path.join(root, "mappings.json"),
  };
}

async function readMappings() {
  try {
    const data = await fs.readFile(getPaths().mappings, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function normalizeKorean(word) {
  return word.trim().normalize("NFC");
}

function hasDuplicate(mappings, korean, excludeId = null) {
  const normalized = normalizeKorean(korean);

  return mappings.some(
    (item) =>
      item.id !== excludeId && normalizeKorean(item.korean) === normalized,
  );
}

async function writeMappings(mappings) {
  const { root, mappings: file } = getPaths();

  await fs.mkdir(root, { recursive: true });

  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(mappings, null, 2), "utf8");
  await fs.rename(temp, file);
}

function checkSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("허용되지 않은 요청입니다.");
  }

  const frameUrl = event.senderFrame?.url || "";

  if (isDev) {
    if (!frameUrl.startsWith("http://localhost:3000/")) {
      throw new Error("허용되지 않은 출처입니다.");
    }
  } else {
    const expected = `http://127.0.0.1:${staticServer.address().port}/`;

    if (!frameUrl.startsWith(expected)) {
      throw new Error("허용되지 않은 출처입니다.");
    }
  }
}

// 등록된 사운드 조회
ipcMain.handle("sound:list", async (event) => {
  checkSender(event);
  return readMappings();
});

// 새 사운드 등록
ipcMain.handle("sound:save", async (event, data) => {
  checkSender(event);

  const korean = data?.korean?.trim();

  if (typeof korean !== "string" || !korean || korean.length > 200) {
    throw new Error("한국어 단어를 확인해주세요.");
  }

  if (
    !Array.isArray(data.bytes) ||
    data.bytes.length === 0 ||
    data.bytes.length > MAX_BYTES
  ) {
    throw new Error("10MB 이하의 녹음 파일만 저장할 수 있습니다.");
  }

  const mimeType = data.mimeType;

  const allowed = {
    "audio/webm": ".webm",
    "audio/webm;codecs=opus": ".webm",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
  };

  const extension = allowed[mimeType];

  if (!extension) {
    throw new Error("지원하지 않는 녹음 형식입니다.");
  }

  const bytes = Buffer.from(data.bytes);

  if (data.bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error("올바르지 않은 파일 데이터입니다.");
  }

  const existingMappings = await readMappings();

  if (hasDuplicate(existingMappings, korean)) {
    throw new Error("이미 있는 단어입니다.");
  }

  const id = crypto.randomUUID();
  const fileName = `${id}${extension}`;
  const { sounds } = getPaths();

  await fs.mkdir(sounds, { recursive: true });

  const filePath = path.join(sounds, fileName);

  await fs.writeFile(filePath, bytes);

  const item = {
    id,
    korean,
    fileName,
    mimeType,
    createdAt: new Date().toISOString(),
  };

  try {
    existingMappings.push(item);
    await writeMappings(existingMappings);
  } catch (error) {
    await fs.unlink(filePath).catch(() => {});
    throw error;
  }

  return item;
});

// 저장된 사운드 파일 읽기
ipcMain.handle("sound:read", async (event, id) => {
  checkSender(event);

  const mappings = await readMappings();
  const item = mappings.find((entry) => entry.id === id);

  if (!item) {
    throw new Error("사운드를 찾을 수 없습니다.");
  }

  const file = path.join(getPaths().sounds, item.fileName);
  const bytes = await fs.readFile(file);

  return {
    bytes: Array.from(bytes),
    mimeType: item.mimeType,
  };
});

// 등록된 사운드 삭제
ipcMain.handle("sound:delete", async (event, id) => {
  checkSender(event);

  const mappings = await readMappings();
  const item = mappings.find((entry) => entry.id === id);

  if (!item) {
    throw new Error("삭제할 사운드를 찾을 수 없습니다.");
  }

  const nextMappings = mappings.filter((entry) => entry.id !== id);

  await writeMappings(nextMappings);

  const file = path.join(getPaths().sounds, item.fileName);
  await fs.unlink(file).catch((error) => {
    if (error.code !== "ENOENT") {
      console.error("파일 삭제 실패:", error);
    }
  });

  return true;
});

async function startStaticServer() {
  const outDir = path.join(app.getAppPath(), "out");

  staticServer = http.createServer((req, res) => {
    return serveHandler(req, res, {
      public: outDir,
      cleanUrls: true,
    });
  });

  await new Promise((resolve, reject) => {
    staticServer.once("error", reject);
    staticServer.listen(0, "127.0.0.1", resolve);
  });

  return staticServer.address().port;
}

async function createWindow() {
  const url = isDev
    ? "http://localhost:3000"
    : `http://127.0.0.1:${await startStaticServer()}`;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon.ico")
      : path.join(__dirname, "../build/icon.ico"),

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));

  mainWindow.webContents.on("will-navigate", (event, nextUrl) => {
    if (!nextUrl.startsWith(url + "/") && nextUrl !== url) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error("앱 실행 실패:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  staticServer?.close();
});

ipcMain.handle("sound:update", async (event, data) => {
  checkSender(event);

  const { id, korean } = data ?? {};

  if (typeof id !== "string" || !id) {
    throw new Error("올바르지 않은 사운드 ID입니다.");
  }

  if (
    typeof korean !== "string" ||
    !korean.trim() ||
    korean.trim().length > 200
  ) {
    throw new Error("한국어 단어를 올바르게 입력해주세요.");
  }

  const mappings = await readMappings();

  if (hasDuplicate(mappings, korean, id)) {
    throw new Error("이미 있는 단어입니다.");
  }

  const index = mappings.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("수정할 사운드를 찾을 수 없습니다.");
  }

  const updated = {
    ...mappings[index],
    korean: korean.trim(),
  };

  mappings[index] = updated;

  await writeMappings(mappings);

  return updated;
});
