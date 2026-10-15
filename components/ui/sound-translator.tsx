"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  AudioLines,
  Languages,
  Play,
  Settings,
  AlertTriangle,
} from "lucide-react";

import {
  DirectionToggle,
  type Direction,
} from "@/components/ui/sound-direction-toggle";

import { SoundWaveform } from "@/components/ui/sound-waveform";

import {
  getSounds,
  playSound,
  speakKorean,
  type SoundMapping,
} from "@/lib/sound-api";

export function SoundTranslator() {
  const [direction, setDirection] = useState<Direction>("ko-to-sound");

  const [mappings, setMappings] = useState<SoundMapping[]>([]);
  const [korean, setKorean] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultSoundId, setResultSoundId] = useState<string | null>(null);
  const [playCount, setPlayCount] = useState(0);

  const loadMappings = useCallback(async () => {
    try {
      const data = await getSounds();
      setMappings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패");
    }
  }, []);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  async function handleTranslate() {
    setBusy(true);
    setError("");
    setOutput("");

    try {
      if (direction === "ko-to-sound") {
        const matched = mappings.find(
          (item) => item.korean.trim() === korean.trim(),
        );

        if (!matched) {
          setResultSoundId(null);
          setOutput("등록된 한국어 단어가 없습니다.");
          return;
        }

        // 재생할 사운드의 파형 표시
        setResultSoundId(matched.id);
        setPlayCount((prev) => prev + 1);

        setOutput(matched.korean);
      } else {
        const matched = mappings.find((item) => item.id === selectedId);

        if (!matched) {
          setOutput("먼저 사운드를 선택해주세요.");
          return;
        }

        setOutput(matched.korean);
        speakKorean(matched.korean);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "번역 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* 상단 헤더 */}

      <header className="flex items-center justify-between border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <AudioLines className="size-5 text-primary" />

          <div className="flex flex-col gap-1">
            <h1 className="font-terminal text-sm font-bold tracking-widest text-accent">
              SOUND_TRANSLATOR
            </h1>

            <span className="font-terminal text-[10px] text-muted-foreground">
              LOCAL AUDIO TRANSLATION SYSTEM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="size-2 rounded-full bg-primary" />
            <span className="font-terminal text-xs text-primary">
              LOCAL READY
            </span>
          </div>

          <Link
            href="/settings"
            title="사운드 관리"
            aria-label="사운드 관리"
            className="flex size-9 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Settings className="size-4" />
          </Link>
        </div>
      </header>

      {/* 번역 방향 */}
      <section className="terminal-panel">
        <div className="terminal-panel-header">
          <span className="text-primary">▪</span>
          TRANSLATION MODE
        </div>

        <div className="flex justify-center p-4">
          <DirectionToggle
            value={direction}
            onChange={(value) => {
              setDirection(value);
              setOutput("");
              setError("");
              setResultSoundId(null);
            }}
          />
        </div>
      </section>

      {/* 입력 영역 */}
      <section className="terminal-panel">
        <div className="terminal-panel-header">
          <span className="text-primary">▪</span>
          INPUT CONSOLE
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="terminal-label">
            {direction === "ko-to-sound"
              ? "INPUT / KOREAN"
              : "INPUT / REGISTERED AUDIO"}
          </div>

          {direction === "ko-to-sound" ? (
            <textarea
              value={korean}
              onChange={(e) => setKorean(e.target.value)}
              placeholder="한국어를 입력하세요..."
              rows={4}
              className="terminal-input resize-none"
            />
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="terminal-input">
              <option value="">사운드를 선택해주세요</option>

              {mappings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.korean} — {item.fileName}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => void handleTranslate()}
            disabled={busy}
            className="terminal-button">
            <Play className="size-4" />
            {busy ? "PROCESSING..." : "EXECUTE TRANSLATION"}
          </button>
        </div>
      </section>

      {/* 결과 영역 */}
      <section className="terminal-panel">
        <div className="terminal-panel-header">
          <span className="text-primary">▪</span>
          TRANSLATION OUTPUT
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="terminal-grid min-h-24 border border-border bg-background p-4">
            <p className="text-base font-medium text-foreground">
              {output || "번역 결과를 기다리는 중..."}
            </p>

            {direction === "ko-to-sound" && resultSoundId && (
              <SoundWaveform
                key={`${resultSoundId}-${playCount}`}
                soundId={resultSoundId}
                autoPlay
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="terminal-status">
              <span className="size-1.5 rounded-full bg-primary" />
              SYSTEM READY
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
