'use client'

import { cn } from '@/lib/utils'

type Props = {
  /** frequency currently coming IN (mic pitch) */
  inFreq?: number
  /** frequency currently going OUT (playback) */
  outFreq?: number
  /** whether mic is actively listening */
  listening?: boolean
}

// human-ish range for the octave we use (roughly C4~C5 with headroom)
const MIN_FREQ = 220
const MAX_FREQ = 560

function freqToPct(freq: number) {
  if (!freq || freq <= 0) return 0
  const clamped = Math.min(Math.max(freq, MIN_FREQ), MAX_FREQ)
  return ((clamped - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)) * 100
}

function Column({
  label,
  freq,
  active,
  variant,
}: {
  label: string
  freq: number
  active: boolean
  variant: 'in' | 'out'
}) {
  const pct = freqToPct(freq)
  const isIn = variant === 'in'
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="relative flex h-40 w-full max-w-10 items-end overflow-hidden rounded-lg border border-border bg-muted/40">
        {/* tick marks */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1 opacity-40">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="mx-1 border-t border-dashed border-border" />
          ))}
        </div>
        <div
          className={cn(
            'w-full rounded-t-md transition-[height] duration-150 ease-out',
            isIn ? 'bg-accent' : 'bg-primary',
            active ? 'opacity-100' : 'opacity-30',
          )}
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {freq > 0 ? `${freq.toFixed(0)}` : '—'}
        <span className="text-[0.6rem]"> Hz</span>
      </span>
    </div>
  )
}

export function FrequencyMeter({ inFreq = 0, outFreq = 0, listening }: Props) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <span className="text-center text-xs font-medium text-muted-foreground">
        주파수
      </span>
      <div className="flex flex-1 gap-3">
        <Column label="입력" freq={inFreq} active={!!listening || inFreq > 0} variant="in" />
        <Column label="출력" freq={outFreq} active={outFreq > 0} variant="out" />
      </div>
    </div>
  )
}
