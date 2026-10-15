"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { getSoundBlob } from "@/lib/sound-api";

type Props = {
  soundId: string;
  autoPlay?: boolean;
};

const BAR_COUNT = 70;

function extractPeaks(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.ceil(data.length / BAR_COUNT));

  const peaks: number[] = [];

  for (let i = 0; i < BAR_COUNT; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);

    let sum = 0;
    let count = 0;

    for (let j = start; j < end; j++) {
      sum += data[j] * data[j];
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sum / count) : 0;
    peaks.push(rms);
  }

  const max = Math.max(...peaks, 0.0001);

  return peaks.map((peak) => {
    const normalized = peak / max;
    return Math.max(0.08, Math.pow(normalized, 0.7));
  });
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);

  return `${min}:${String(sec).padStart(2, "0")}`;
}

export function SoundWaveform({ soundId, autoPlay = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [url, setUrl] = useState("");
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    let context: AudioContext | null = null;

    async function loadAudio() {
      setLoading(true);
      setError("");
      setUrl("");
      setPeaks([]);
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);

      try {
        const blob = await getSoundBlob(soundId);

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        context = new AudioContext();

        const arrayBuffer = await blob.arrayBuffer();

        const audioBuffer = await context.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        setPeaks(extractPeaks(audioBuffer));
        setDuration(audioBuffer.duration);
        setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "파형을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
        if (context) await context.close();
      }
    }

    void loadAudio();

    return () => {
      cancelled = true;

      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [soundId]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError("오디오를 재생할 수 없습니다.");
    }
  }

  async function replay() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      setError("오디오를 재생할 수 없습니다.");
    }
  }

  function seek(ratio: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          사운드 분석 중...
        </div>
      ) : error && !url ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <>
          {/* 실제 사운드 파형 */}
          <div
            className="flex h-24 items-center gap-[2px] rounded-xl bg-muted/40 px-3"
            aria-label="녹음된 사운드의 파형"
            role="img">
            {peaks.map((peak, index) => {
              const isPlayed = index / peaks.length <= progress;

              return (
                <div
                  key={index}
                  className={
                    "min-w-0 flex-1 rounded-full transition-colors duration-100 " +
                    (isPlayed ? "bg-primary" : "bg-accent/60")
                  }
                  style={{
                    height: `${Math.max(4, peak * 80)}%`,
                  }}
                />
              );
            })}
          </div>

          {/* 재생 위치 */}
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={(event) => seek(Number(event.target.value) / 1000)}
            aria-label="사운드 재생 위치"
            className="w-full accent-primary"
          />

          {/* 재생 컨트롤 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void togglePlay()}
                aria-label={playing ? "일시정지" : "재생"}
                className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {playing ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => void replay()}
                aria-label="처음부터 다시 듣기"
                className="flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted">
                <RotateCcw className="size-4" />
              </button>
            </div>

            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </>
      )}

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          onCanPlay={(event) => {
            if (autoPlay) {
              event.currentTarget.play().catch(() => {
                setError("자동 재생이 차단되었습니다. 재생 버튼을 눌러주세요.");
              });
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) =>
            setCurrentTime(event.currentTarget.currentTime)
          }
          onLoadedMetadata={(event) => {
            if (Number.isFinite(event.currentTarget.duration)) {
              setDuration(event.currentTarget.duration);
            }
          }}
        />
      )}
    </div>
  );
}
