"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Direction = "piano-to-ko" | "ko-to-piano";

type DirectionToggleProps = {
  value: Direction;
  onChange: (value: Direction) => void;
};

const options: { value: Direction; from: string; to: string }[] = [
  { value: "piano-to-ko", from: "피아노", to: "한국어" },
  { value: "ko-to-piano", from: "한국어", to: "피아노" },
];

export function DirectionToggle({ value, onChange }: DirectionToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="번역 방향 선택"
      className="inline-flex w-full rounded-xl border border-border bg-muted p-1 sm:w-auto">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}>
            <span>{opt.from}</span>
            <ArrowRight className="size-3.5 opacity-60" aria-hidden="true" />
            <span>{opt.to}</span>
          </button>
        );
      })}
    </div>
  );
}
