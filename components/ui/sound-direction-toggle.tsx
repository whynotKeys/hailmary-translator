"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Direction = "sound-to-ko" | "ko-to-sound";

type Props = {
  value: Direction;
  onChange: (value: Direction) => void;
};

const options = [
  {
    value: "sound-to-ko" as const,
    from: "SOUND",
    to: "KOREAN",
  },
  {
    value: "ko-to-sound" as const,
    from: "KOREAN",
    to: "SOUND",
  },
];

export function DirectionToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex w-full rounded-xl border border-border bg-muted p-1 sm:w-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none",
            value === option.value
              ? "border border-primary/60 bg-primary/10 text-primary"
              : "border border-transparent text-muted-foreground hover:text-foreground",
          )}>
          {option.from}
          <ArrowRight size={14} />
          {option.to}
        </button>
      ))}
    </div>
  );
}
