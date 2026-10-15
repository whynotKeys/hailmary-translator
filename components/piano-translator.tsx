"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Piano,
  Languages,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Keyboard,
  AudioLines,
  AlertTriangle,
  Settings,
  RefreshCcw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PIANO_KEYS,
  DEFAULT_MAPPING,
  STORAGE_KEY,
  type PianoKey,
} from "@/lib/piano-data";
import { usePitchDetection } from "@/lib/use-pitch-detection";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { DirectionToggle, type Direction } from "@/components/direction-toggle";
import { MappingEditor } from "@/components/mapping-editor";
import { FrequencyMeter } from "@/components/frequency-meter";

const keyById = new Map(PIANO_KEYS.map((k) => [k.id, k]));
const keyByKbd = new Map(PIANO_KEYS.map((k) => [k.kbd, k]));

export function PianoTranslator() {
  const [direction, setDirection] = useState<Direction>("piano-to-ko"); // 번역 방향
  const [mapping, setMapping] =
    useState<Record<string, string>>(DEFAULT_MAPPING); // 저장된 값
  const [notes, setNotes] = useState<string[]>([]); // 입력된 음
  const [koreanInput, setKoreanInput] = useState(""); // 입력된 한국어
  const [output, setOutput] = useState(""); // 출력되는 값
  const [unregistered, setUnregistered] = useState<string[]>([]); // 미등록 입력값
  const [translated, setTranslated] = useState(false); // 번역된 내용
  const [playbackIds, setPlaybackIds] = useState<string[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outFreq, setOutFreq] = useState(0);

  const audioRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  const isPiano = direction === "piano-to-ko";

  // load saved mapping
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMapping({ ...DEFAULT_MAPPING, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const getAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioRef.current = new Ctx();
    }
    return audioRef.current;
  }, []);

  // 피아노 음 연주하는 기능
  const playTone = useCallback(
    (freq: number, duration = 0.5) => {
      const ctx = getAudio();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
      // reflect the note going out on the frequency meter
      setOutFreq(freq);
      window.setTimeout(() => {
        setOutFreq((cur) => (cur === freq ? 0 : cur));
      }, duration * 1000);
    },
    [getAudio],
  );

  const flash = useCallback((id: string, ms = 260) => {
    setActiveIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, ms);
  }, []);

  const addNote = useCallback((key: PianoKey) => {
    setNotes((prev) => [...prev, key.id]);
  }, []);

  const handleKeyPress = useCallback(
    (key: PianoKey) => {
      playTone(key.freq);
      flash(key.id);
      if (isPiano) addNote(key);
    },
    [isPiano, playTone, flash, addNote],
  );

  // --- mic pitch detection (piano note recognition) ---
  const onPitchNote = useCallback(
    (key: PianoKey) => {
      flash(key.id);
      if (isPiano) addNote(key);
    },
    [isPiano, flash, addNote],
  );
  const pitch = usePitchDetection({ onNote: onPitchNote });

  // --- physical keyboard input ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const key = keyByKbd.get(e.key.toLowerCase());
      if (key) {
        e.preventDefault();
        handleKeyPress(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKeyPress]);

  const playSequence = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        const key = keyById.get(id);
        if (!key) continue;
        playTone(key.freq, 0.45);
        flash(id, 320);
        await new Promise((r) => setTimeout(r, 360));
      }
    },
    [playTone, flash],
  );

  // 한글로 읽어주는 기능
  const speakKorean = useCallback((text: string) => {
    if (typeof window === "undefined") return;

    if (!("speechSynthesis" in window)) {
      console.error("이 브라우저는 음성 읽기를 지원하지 않습니다.");
      return;
    }

    // 이미 읽고 있는 음성이 있다면 중지
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "ko-KR";
    utterance.rate = 1; // 말하기 속도
    utterance.pitch = 1; // 음높이
    utterance.volume = 1; // 볼륨

    window.speechSynthesis.speak(utterance);
  }, []);

  const handleTranslate = useCallback(() => {
    setTranslated(true);

    if (isPiano) {
      const words: string[] = [];
      const missing: string[] = [];

      notes.forEach((id) => {
        const word = mapping[id];

        if (word && word.trim()) {
          words.push(word);
        } else {
          missing.push(keyById.get(id)?.solfege ?? id);
        }
      });

      const translatedText = words.length
        ? words.join(" ")
        : "대응하는 단어가 없습니다.";

      setOutput(translatedText);
      setUnregistered(missing);
      setPlaybackIds(notes.filter((id) => mapping[id]));

      // 음 -> 한글 번역일 때만 읽기
      if (words.length > 0) {
        speakKorean(translatedText);
      }
    } else {
      const reverse = new Map<string, string>();
      Object.entries(mapping).forEach(([id, word]) => {
        if (word && word.trim()) reverse.set(word.trim(), id);
      });
      const tokens = koreanInput.trim().split(/\s+/).filter(Boolean);
      const ids: string[] = [];
      const solfege: string[] = [];
      const missing: string[] = [];
      tokens.forEach((token) => {
        const id = reverse.get(token);
        if (id) {
          ids.push(id);
          solfege.push(keyById.get(id)?.solfege ?? "?");
        } else {
          solfege.push("·");
          missing.push(token);
        }
      });
      setOutput(solfege.length ? solfege.join("  ") : "연주할 음이 없습니다.");
      setUnregistered(missing);
      setPlaybackIds(ids);
      // auto-play the translated notes once
      if (ids.length) {
        window.setTimeout(() => {
          void playSequence(ids);
        }, 250);
      }
    }
  }, [isPiano, notes, koreanInput, mapping, playSequence, speakKorean]);

  const handlePlay = useCallback(() => {
    const ids = playbackIds.length ? playbackIds : isPiano ? notes : [];
    void playSequence(ids);
  }, [playbackIds, notes, isPiano, playSequence]);

  const handleClear = useCallback(() => {
    setNotes([]);
    setKoreanInput("");
    setOutput("");
    setUnregistered([]);
    setTranslated(false);
    setPlaybackIds([]);
  }, []);

  // mapping controls
  const handleChangeWord = useCallback((keyId: string, word: string) => {
    setSaved(false);
    setMapping((prev) => ({ ...prev, [keyId]: word }));
  }, []);

  const handleSaveMapping = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    }
  }, [mapping]);

  const handleResetMapping = useCallback(() => {
    setMapping(DEFAULT_MAPPING);
    setSaved(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // 한국어 음성 입력
  const toggleVoice = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setKoreanInput((prev) => prev);
      setOutput("이 브라우저는 음성 입력을 지원하지 않습니다.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setKoreanInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* header */}
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-black border-2 border-white text-primary-foreground shadow-sm">
          {/* <Orbit className="size-6" aria-hidden="true" /> */}
          <Piano className="size-6 text-white" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl font-bold text-balance sm:text-3xl">
          피아노 번역기
        </h1>
        <p className="max-w-md text-sm text-pretty text-muted-foreground">
          피아노 음을 한국어로, 한국어를 피아노 음으로 번역
        </p>
      </header>

      {/* direction */}
      <section className="flex flex-col items-center gap-3 rounded-2xl p-4">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          번역 방향
        </span>
        <DirectionToggle value={direction} onChange={setDirection} />
      </section>

      {/* piano input area */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Piano className="size-4 text-primary" aria-hidden="true" />
            <h2 className="font-display text-sm font-semibold">피아노 입력</h2>
          </div>
          {/* mic pitch recognition button */}
          <button
            type="button"
            onClick={pitch.toggle}
            aria-pressed={pitch.listening}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
              pitch.listening
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}>
            {pitch.listening ? (
              <AudioLines
                className="size-3.5 animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <Mic className="size-3.5" aria-hidden="true" />
            )}
            {pitch.listening ? "음 인식 종료" : "마이크 음 인식"}
          </button>
        </div>

        {/* recognized note & frequency */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
            pitch.listening
              ? "border-accent/40 bg-accent/8"
              : "border-dashed border-border bg-muted/40",
          )}>
          <span className="text-xs font-medium text-muted-foreground">
            현재 인식된 음
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-bold tabular-nums text-foreground">
              {pitch.key ? pitch.key.solfege : "—"}
            </span>
            <span className="min-w-20 text-right font-mono text-sm tabular-nums text-muted-foreground">
              {pitch.freq > 0 ? `${pitch.freq.toFixed(1)} Hz` : "0.0 Hz"}
            </span>
          </div>
        </div>
        {pitch.error && (
          <p className="text-xs text-destructive">{pitch.error}</p>
        )}

        {/* keyboard + frequency meter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="min-w-0 flex-1">
            <PianoKeyboard activeIds={activeIds} onPress={handleKeyPress} />
          </div>
          <div className="sm:w-40">
            <FrequencyMeter
              inFreq={pitch.freq}
              outFreq={outFreq}
              listening={pitch.listening}
            />
          </div>
        </div>

        {/* input piano notes — right below the keyboard */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            입력된 피아노 음
          </span>
          <div className="flex min-h-14 flex-wrap content-center items-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 p-2.5">
            {notes.length === 0 ? (
              <p className="m-auto text-xs text-muted-foreground">
                아직 입력된 음이 없습니다.
              </p>
            ) : (
              notes.map((id, i) => (
                <span
                  key={`${id}-${i}`}
                  className="flex size-9 items-center justify-center rounded-lg bg-primary/12 font-display text-sm font-semibold text-primary">
                  {keyById.get(id)?.solfege}
                </span>
              ))
            )}
          </div>
        </div>

        {/* keyboard input guide */}
        <div className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <Keyboard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-pretty leading-relaxed">
            건반을 클릭하거나 마이크로 연주하세요. 컴퓨터 키보드{" "}
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              A
            </kbd>{" "}
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              S
            </kbd>{" "}
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              D
            </kbd>{" "}
            … 키로도 흰 건반을,{" "}
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              W
            </kbd>{" "}
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              E
            </kbd>{" "}
            ..키로 검은 건반을 연주할 수 있어요.
          </p>
        </div>
      </section>

      <section className="flex flex-row gap-3">
        {/* korean input area */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 w-1/2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold">
                한국어 입력
              </h2>
            </div>
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={listening}
              aria-label="음성 입력"
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                listening
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}>
              {listening ? (
                <MicOff className="size-3.5" aria-hidden="true" />
              ) : (
                <Mic className="size-3.5" aria-hidden="true" />
              )}
              {listening ? "듣는 중…" : "음성 입력"}
            </button>
          </div>
          <textarea
            value={koreanInput}
            onChange={(e) => setKoreanInput(e.target.value)}
            placeholder="예) 안녕 나는 외계인"
            rows={3}
            className="resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {/* output area */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 w-1/2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h2 className="font-display text-sm font-semibold">번역 결과</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {isPiano ? "피아노->한국어" : "한국어->피아노"} 번역 결과
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex min-h-20 items-center rounded-xl border border-border bg-accent/8 p-4 mt-2">
              {output ? (
                <p
                  className={cn(
                    "text-pretty",
                    isPiano
                      ? "text-lg font-medium"
                      : "font-display text-2xl font-semibold tracking-wide text-accent",
                  )}>
                  {output}
                </p>
              ) : (
                <p className="m-auto text-center text-xs text-muted-foreground">
                  번역 버튼을 누르면 결과가 표시됩니다.
                </p>
              )}
            </div>
          </div>

          {/* unregistered words notice */}
          {translated && unregistered.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2.5">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1.5 text-xs">
                <span className="font-medium text-destructive">
                  사전에 등록되지 않은 {isPiano ? "음" : "단어"}이 있어요
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {unregistered.map((w, i) => (
                    <span
                      key={`${w}-${i}`}
                      className="rounded-md bg-destructive/12 px-2 py-0.5 font-medium text-destructive">
                      {w}
                    </span>
                  ))}
                </div>
                <span className="text-muted-foreground">
                  아래 &lsquo;음 · 단어 매핑 수정&rsquo;에서 등록할 수 있습니다.
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* control buttons */}
      <section className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4">
        <button
          type="button"
          onClick={handleTranslate}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
          <Languages className="size-4" aria-hidden="true" />
          번역
        </button>
        <button
          type="button"
          onClick={handlePlay}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 active:translate-y-px">
          <Play className="size-4" aria-hidden="true" />
          재생
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground active:translate-y-px">
          <RefreshCcw className="size-4" aria-hidden="true" />
          입력 초기화
        </button>
      </section>

      {/* dictionary / mapping editor */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <details className="group">
          <summary className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold">
                음 · 단어 매핑 수정
              </h2>
            </div>
            <ChevronDown className="transition group-open:rotate-180" />
          </summary>

          <div className="flex-col gap-2">
            <div>
              <MappingEditor
                mapping={mapping}
                onChangeWord={handleChangeWord}
              />
            </div>

            <div className="flex gap-2 justify-end mt-3">
              <button
                type="button"
                onClick={handleSaveMapping}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:translate-y-px">
                <Save className="size-3.5" aria-hidden="true" />
                {saved ? "저장됨" : "저장"}
              </button>
              <button
                type="button"
                onClick={handleResetMapping}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground active:translate-y-px">
                <RotateCcw className="size-3.5" aria-hidden="true" />
                초기화
              </button>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
