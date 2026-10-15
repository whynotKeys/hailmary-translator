"use client";

import { Music2 } from "lucide-react";
import { PIANO_KEYS } from "@/lib/piano-data";

type MappingEditorProps = {
  mapping: Record<string, string>;
  onChangeWord: (keyId: string, word: string) => void;
};

// only the natural (white) notes carry word mappings
const mappedKeys = PIANO_KEYS.filter((k) => !k.black);

export function MappingEditor({ mapping, onChangeWord }: MappingEditorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mt-5">
      {mappedKeys.map((key) => (
        <label
          key={key.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 font-display text-sm font-semibold text-primary">
            {key.solfege}
          </span>
          <Music2
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={mapping[key.id] ?? ""}
            onChange={(e) => onChangeWord(key.id, e.target.value)}
            placeholder="단어 입력"
            aria-label={`${key.solfege} 음에 대응하는 단어`}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
      ))}
    </div>
  );
}
