"use client";

import { useState } from "react";
import { LoaderCircle, AudioLines } from "lucide-react";

import { SoundRecorder } from "@/components/ui/sound-recorder";

type Props = {
  label: string;
  onRecognize: (blob: Blob) => Promise<void>;
};

export function RecognitionInput({ label, onRecognize }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recorderKey, setRecorderKey] = useState(0);

  async function handleRecorded(blob: Blob | null) {
    if (!blob || busy) return;

    setBusy(true);
    setError("");

    try {
      await onRecognize(blob);

      // 인식이 끝나면 녹음 UI 초기화
      setRecorderKey((prev) => prev + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "소리 인식에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AudioLines className="size-4 text-primary" />
          <span className="terminal-label">{label}</span>
        </div>

        {busy && (
          <span className="flex items-center gap-2 font-terminal text-xs text-primary">
            <LoaderCircle className="size-3 animate-spin" />
            ANALYZING
          </span>
        )}
      </div>

      <div className={busy ? "pointer-events-none opacity-50" : ""}>
        <SoundRecorder
          key={recorderKey}
          onRecorded={(blob) => {
            void handleRecorded(blob);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
