"use client";

import { cn } from "@/lib/utils";
import { PIANO_KEYS, type PianoKey } from "@/lib/piano-data";

type PianoKeyboardProps = {
  activeIds: Set<string>;
  onPress: (key: PianoKey) => void;
};

const whiteKeys = PIANO_KEYS.filter((k) => !k.black);

// which white-key index each black key sits after
const blackKeyOffset: Record<string, number> = {
  "C#4": 0,
  "D#4": 1,
  "F#4": 3,
  "G#4": 4,
  "A#4": 5,
};

export function PianoKeyboard({ activeIds, onPress }: PianoKeyboardProps) {
  const whiteCount = whiteKeys.length;

  return (
    <div className="relative w-full select-none mt-1">
      {/* white keys */}
      <div className="flex w-full gap-1">
        {whiteKeys.map((key) => {
          const active = activeIds.has(key.id);
          return (
            <button
              key={key.id}
              type="button"
              onPointerDown={() => onPress(key)}
              aria-label={`${key.solfege} (${key.note})`}
              className={cn(
                "flex h-40 flex-1 flex-col items-center justify-end rounded-b-xl border border-border pb-3 shadow-sm transition-all sm:h-52",
                "active:translate-y-px",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary",
              )}>
              <span className="font-display text-base font-semibold">
                {key.solfege}
              </span>
              <span className="text-[0.65rem] opacity-70">{key.note}</span>
              <kbd
                className={cn(
                  "mt-1.5 rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase",
                  active
                    ? "border-primary-foreground/40 text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}>
                {key.kbd}
              </kbd>
            </button>
          );
        })}
      </div>

      {/* black keys */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 sm:h-32">
        {PIANO_KEYS.filter((k) => k.black).map((key) => {
          const active = activeIds.has(key.id);
          const idx = blackKeyOffset[key.id];
          const unit = 100 / whiteCount;
          const left = `calc(${(idx + 1) * unit}% - ${unit * 0.28}%)`;
          return (
            <button
              key={key.id}
              type="button"
              onPointerDown={() => onPress(key)}
              aria-label={`${key.solfege} (${key.note})`}
              style={{ left, width: `${unit * 0.56}%` }}
              className={cn(
                "pointer-events-auto absolute top-0 flex h-full flex-col items-center justify-end rounded-b-lg pb-2 text-[0.6rem] shadow-md transition-all",
                "active:translate-y-px",
                active
                  ? "bg-accent text-accent-foreground"
                  : "bg-foreground text-background/80 hover:bg-foreground/85",
              )}>
              <span>{key.solfege}</span>
              <kbd className="mt-1 font-mono text-[0.55rem] uppercase opacity-70">
                {key.kbd}
              </kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
