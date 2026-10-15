export type PianoKey = {
  /** unique note id, e.g. "C4" */
  id: string;
  /** solfège label shown on the key, e.g. "도" */
  solfege: string;
  /** western note name, e.g. "C" */
  note: string;
  /** playback frequency in Hz */
  freq: number;
  /** true for the black (sharp) keys */
  black: boolean;
  /** physical keyboard key that triggers this note */
  kbd: string;
};

/** One octave of keys (C4 - C5) used for both display and input. */
export const PIANO_KEYS: PianoKey[] = [
  { id: "C4", solfege: "도", note: "C", freq: 261.63, black: false, kbd: "a" },
  {
    id: "C#4",
    solfege: "도#",
    note: "C#",
    freq: 277.18,
    black: true,
    kbd: "w",
  },
  { id: "D4", solfege: "레", note: "D", freq: 293.66, black: false, kbd: "s" },
  {
    id: "D#4",
    solfege: "레#",
    note: "D#",
    freq: 311.13,
    black: true,
    kbd: "e",
  },
  { id: "E4", solfege: "미", note: "E", freq: 329.63, black: false, kbd: "d" },
  { id: "F4", solfege: "파", note: "F", freq: 349.23, black: false, kbd: "f" },
  {
    id: "F#4",
    solfege: "파#",
    note: "F#",
    freq: 369.99,
    black: true,
    kbd: "t",
  },
  { id: "G4", solfege: "솔", note: "G", freq: 392.0, black: false, kbd: "g" },
  { id: "G#4", solfege: "솔#", note: "G#", freq: 415.3, black: true, kbd: "y" },
  { id: "A4", solfege: "라", note: "A", freq: 440.0, black: false, kbd: "h" },
  {
    id: "A#4",
    solfege: "라#",
    note: "A#",
    freq: 466.16,
    black: true,
    kbd: "u",
  },
  { id: "B4", solfege: "시", note: "B", freq: 493.88, black: false, kbd: "j" },
  { id: "C5", solfege: "도²", note: "C", freq: 523.25, black: false, kbd: "k" },
];

/** Default note → Korean word mapping. Editable by the user. */
export const DEFAULT_MAPPING: Record<string, string> = {
  C4: "안녕",
  D4: "나는",
  E4: "외계인",
  F4: "반가워",
  G4: "오늘",
  A4: "기분이",
  B4: "좋아",
  C5: "물음표",
};

export const STORAGE_KEY = "piano-translator-mapping";

/** Map a detected frequency to the nearest piano key (octave-folded). */
export function frequencyToKey(
  freq: number,
): { key: PianoKey; cents: number } | null {
  if (!freq || freq <= 0) return null;
  let best: PianoKey | null = null;
  let bestDiff = Infinity;
  for (const key of PIANO_KEYS) {
    let f = freq;
    // fold the detected frequency into the same octave as this key
    while (f > key.freq * Math.SQRT2) f /= 2;
    while (f < key.freq / Math.SQRT2) f *= 2;
    const diff = Math.abs(1200 * Math.log2(f / key.freq));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = key;
    }
  }
  return best ? { key: best, cents: bestDiff } : null;
}
