"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play } from "lucide-react";

type Props = {
  onRecorded: (blob: Blob | null) => void;
};

export function SoundRecorder({ onRecorded }: Props) {
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    try {
      setError("");

      // 이전 녹음 데이터 초기화
      onRecorded(null);

      // 기존 마이크 연결 코드 계속...
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      if (!mimeType) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("지원하는 오디오 녹음 형식이 없습니다.");
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });

        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });

        onRecorded(blob);

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "마이크 사용 실패");
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recording ? stop : start}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {recording ? <Square size={16} /> : <Mic size={16} />}
          {recording ? "녹음 종료" : "녹음 시작"}
        </button>

        {recording && (
          <span className="text-sm text-destructive animate-pulse">
            녹음 중...
          </span>
        )}

        {previewUrl && !recording && (
          <button
            type="button"
            onClick={() => {
              const audio = new Audio(previewUrl);
              void audio.play();
            }}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Play size={16} />
            미리 듣기
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
