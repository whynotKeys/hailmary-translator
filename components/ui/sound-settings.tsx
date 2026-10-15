"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  ArrowLeft,
  Mic,
  Play,
  Pencil,
  Save,
  Trash2,
  X,
  Settings,
  Database,
  AudioLines,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { SoundRecorder } from "@/components/ui/sound-recorder";

import {
  getSounds,
  saveSound,
  updateSound,
  deleteSound,
  playSound,
  type SoundMapping,
} from "@/lib/sound-api";

export function SoundSettings() {
  const [mappings, setMappings] = useState<SoundMapping[]>([]);

  // 새 사운드 등록
  const [recordWord, setRecordWord] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);

  // 기존 매핑 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadMappings = useCallback(async () => {
    const data = await getSounds();
    setMappings(data);
  }, []);

  useEffect(() => {
    loadMappings().catch((err) => {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패");
    });
  }, [loadMappings]);

  // 한국어 중복 여부 확인
  function isDuplicate(word: string, excludeId?: string) {
    const normalized = word.trim().normalize("NFC");

    return mappings.some(
      (item) =>
        item.id !== excludeId &&
        item.korean.trim().normalize("NFC") === normalized,
    );
  }

  function showError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : fallback;

    if (message.includes("이미 있는 단어입니다")) {
      window.alert("이미 있는 단어입니다.");
      return;
    }

    setError(message);
  }

  // 새 사운드 저장
  async function handleSave() {
    const word = recordWord.trim();

    if (!word || !recordedBlob) {
      setError("한국어 단어와 녹음 파일을 준비해주세요.");
      return;
    }

    if (isDuplicate(word)) {
      window.alert("이미 있는 단어입니다.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await saveSound(word, recordedBlob);
      await loadMappings();

      setRecordWord("");
      setRecordedBlob(null);
      setRecorderKey((prev) => prev + 1);

      setMessage("새 사운드가 등록되었습니다.");
    } catch (err) {
      showError(err, "등록 실패");
    } finally {
      setBusy(false);
    }
  }

  // 수정 시작
  function startEdit(item: SoundMapping) {
    setEditingId(item.id);
    setEditingWord(item.korean);
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingWord("");
  }

  // 한국어 매핑 수정
  async function handleUpdate(id: string) {
    const word = editingWord.trim();

    if (!word) {
      setError("수정할 한국어를 입력해주세요.");
      return;
    }

    if (isDuplicate(word, id)) {
      window.alert("이미 있는 단어입니다.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await updateSound(id, word);
      await loadMappings();

      cancelEdit();
      setMessage("한국어 매핑이 수정되었습니다.");
    } catch (err) {
      showError(err, "수정 실패");
    } finally {
      setBusy(false);
    }
  }

  // 사운드 삭제
  async function handleDelete(id: string) {
    if (!window.confirm("이 사운드를 삭제하시겠습니까?")) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await deleteSound(id);
      await loadMappings();

      if (editingId === id) cancelEdit();

      setMessage("사운드가 삭제되었습니다.");
    } catch (err) {
      showError(err, "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  // 미리 듣기
  async function handlePlay(id: string) {
    try {
      await playSound(id);
    } catch (err) {
      showError(err, "재생 실패");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      {/* HEADER */}
      <header className="terminal-panel flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Settings className="size-5 text-primary" />

          <div className="flex flex-col gap-1">
            <h1 className="font-terminal text-sm font-bold tracking-widest text-accent">
              SOUND_DATABASE
            </h1>

            <span className="font-terminal text-[10px] text-muted-foreground">
              LOCAL AUDIO MAPPING MANAGEMENT
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 border border-border bg-background px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          <ArrowLeft className="size-4" />
          BACK
        </Link>
      </header>

      {/* STATUS BAR */}
      <div className="terminal-panel flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <span className="terminal-status">
          <span className="size-2 rounded-full bg-primary" />
          LOCAL STORAGE
        </span>

        <div className="flex items-center gap-4 font-terminal text-[11px]">
          <span className="text-muted-foreground">TOTAL ENTRIES</span>
          <span className="text-primary">
            {String(mappings.length).padStart(3, "0")}
          </span>
        </div>
      </div>

      {/* REGISTRATION */}
      <section className="terminal-panel">
        <div className="terminal-panel-header">
          <span className="text-primary">▪</span>
          AUDIO REGISTRATION
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="register-word" className="terminal-label">
              MAPPING / KOREAN
            </label>

            <input
              id="register-word"
              value={recordWord}
              maxLength={200}
              onChange={(e) => setRecordWord(e.target.value)}
              placeholder="연결할 한국어 단어 입력..."
              className="terminal-input"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="terminal-label">AUDIO CAPTURE</span>

            <div className="border border-border bg-background p-4">
              <SoundRecorder key={recorderKey} onRecorded={setRecordedBlob} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="terminal-status">
              <span
                className={
                  "size-1.5 rounded-full " +
                  (recordedBlob ? "bg-primary" : "bg-muted-foreground")
                }
              />
              {recordedBlob ? "AUDIO CAPTURED" : "WAITING FOR AUDIO"}
            </span>

            <button
              type="button"
              disabled={busy || !recordWord.trim() || !recordedBlob}
              onClick={() => void handleSave()}
              className="terminal-button">
              <Save className="size-4" />
              {busy ? "SAVING..." : "SAVE MAPPING"}
            </button>
          </div>
        </div>
      </section>

      {/* DATABASE LIST */}
      <section className="terminal-panel">
        <div className="terminal-panel-header justify-between">
          <span className="flex items-center gap-2">
            <span className="text-primary">▪</span>
            MAPPING DATABASE
          </span>

          <span className="font-terminal text-[10px] text-primary">
            ENTRIES {mappings.length}
          </span>
        </div>

        <div className="p-4">
          {mappings.length === 0 ? (
            <div className="terminal-grid flex min-h-32 flex-col items-center justify-center gap-3 border border-dashed border-border">
              <Database className="size-6 text-muted-foreground" />

              <span className="font-terminal text-xs text-muted-foreground">
                NO AUDIO MAPPINGS FOUND
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {mappings.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-border bg-background p-3 transition-colors hover:border-primary/40">
                  {editingId === item.id ? (
                    <div className="flex flex-col gap-3">
                      <label className="terminal-label">
                        EDIT / KOREAN MAPPING
                      </label>

                      <input
                        value={editingWord}
                        maxLength={200}
                        onChange={(e) => setEditingWord(e.target.value)}
                        className="terminal-input"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={cancelEdit}
                          className="flex items-center gap-2 border border-border px-3 py-2 text-xs hover:border-primary">
                          <X className="size-3.5" />
                          CANCEL
                        </button>

                        <button
                          type="button"
                          disabled={busy || !editingWord.trim()}
                          onClick={() => void handleUpdate(item.id)}
                          className="terminal-button">
                          <Save className="size-3.5" />
                          SAVE
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-terminal text-xs text-muted-foreground">
                          {String(index + 1).padStart(3, "0")}
                        </span>

                        <AudioLines className="size-4 shrink-0 text-accent" />

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.korean}
                          </p>

                          <p className="truncate font-terminal text-[10px] text-muted-foreground">
                            {item.fileName}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void handlePlay(item.id)}
                          title="미리 듣기"
                          aria-label={`${item.korean} 재생`}
                          className="border border-border p-2 text-accent hover:border-accent">
                          <Play className="size-4" />
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(item)}
                          title="한국어 수정"
                          aria-label={`${item.korean} 수정`}
                          className="border border-border p-2 text-primary hover:border-primary">
                          <Pencil className="size-4" />
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDelete(item.id)}
                          title="삭제"
                          aria-label={`${item.korean} 삭제`}
                          className="border border-border p-2 text-destructive hover:border-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FEEDBACK */}
      {message && (
        <div
          role="status"
          className="flex items-center gap-2 border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="size-4" />
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      <footer className="flex justify-between font-terminal text-[10px] text-muted-foreground">
        <span>LOCAL DATA STORAGE</span>
        <span>SOUND_TRANSLATOR / DATABASE</span>
      </footer>
    </div>
  );
}
