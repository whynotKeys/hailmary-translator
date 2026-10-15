"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AudioLines, Play, Settings, AlertTriangle } from "lucide-react";

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

import { RecognitionInput } from "@/components/ui/recognition-input";

import {
  recognizeKoreanVoice,
  recognizeInputSound,
  normalizeKorean,
} from "@/lib/recognition-api";

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
  const [recognizedSound, setRecognizedSound] = useState("");
  const [recognitionDistance, setRecognitionDistance] = useState<number | null>(
    null,
  );
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

  function translateKorean(text: string) {
    const normalized = normalizeKorean(text);

    const matched = mappings.find(
      (item) => normalizeKorean(item.korean) === normalized,
    );

    setResultSoundId(null);

    if (!matched) {
      setOutput("등록된 한국어 단어가 없습니다.");
      return;
    }

    setResultSoundId(matched.id);
    setPlayCount((prev) => prev + 1);
    setOutput(matched.korean);
  }
  // 한국어 음성 → 텍스트 → 사운드 재생
  async function handleKoreanVoice(blob: Blob) {
    setError("");
    setOutput("");
    setResultSoundId(null);

    const result = await recognizeKoreanVoice(blob);
    const text = normalizeKorean(result.text);

    if (!text) {
      throw new Error("한국어 음성을 인식하지 못했습니다.");
    }

    // 인식된 한국어를 입력창에 표시
    setKorean(text);

    // 인식 결과를 기존 번역 함수에 바로 전달
    translateKorean(text);
  }

  // 사운드 녹음 → 유사 사운드 검색 → 한국어 TTS
  async function handleSoundRecognition(blob: Blob) {
    setError("");
    setOutput("");
    setRecognizedSound("");
    setRecognitionDistance(null);

    const result = await recognizeInputSound(blob);

    if (!result.matched) {
      throw new Error("비교 가능한 등록 사운드가 없습니다.");
    }

    const { korean } = result.matched;

    setSelectedId(result.matched.id);
    setRecognizedSound(korean);
    setRecognitionDistance(result.distance);

    setOutput(korean);
    speakKorean(korean);
  }

  async function handleTranslate() {
    setBusy(true);
    setError("");
    setOutput("");

    try {
      if (direction === "ko-to-sound") {
        translateKorean(korean);
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
              setRecognizedSound("");
              setRecognitionDistance(null);
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
            <div className="flex flex-col gap-4">
              {/* 한국어 자판 입력 */}
              <textarea
                value={korean}
                onChange={(e) => setKorean(e.target.value)}
                placeholder="한국어를 입력하거나 마이크로 말해주세요."
                rows={4}
                className="terminal-input resize-none"
              />

              {/* 한국어 음성 인식 */}
              <RecognitionInput
                label="VOICE INPUT / KOREAN"
                onRecognize={handleKoreanVoice}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 사운드 선택 */}
              <div className="flex flex-col gap-2">
                <label className="terminal-label">
                  MANUAL SELECTION / AUDIO
                </label>

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
              </div>

              {/* 사운드 자동 인식 */}
              <RecognitionInput
                label="LIVE INPUT / SOUND RECOGNITION"
                onRecognize={handleSoundRecognition}
              />

              {/* 인식 결과 */}
              {recognizedSound && (
                <div className="border border-primary/40 bg-primary/10 p-3">
                  <p className="terminal-label mb-2">NEAREST AUDIO MATCH</p>

                  <p className="text-sm font-semibold text-primary">
                    {recognizedSound}
                  </p>

                  <p className="mt-2 font-terminal text-xs text-muted-foreground">
                    DTW DISTANCE: {recognitionDistance?.toFixed(4) ?? "—"}
                  </p>
                </div>
              )}
            </div>
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
