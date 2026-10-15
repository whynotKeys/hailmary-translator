'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { frequencyToKey, type PianoKey } from '@/lib/piano-data'

/** Autocorrelation pitch detector. Returns frequency in Hz, or -1 if unclear. */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return -1 // too quiet

  let r1 = 0
  let r2 = SIZE - 1
  const thres = 0.2
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i
      break
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i
      break
    }
  }

  const b = buf.slice(r1, r2)
  const size2 = b.length
  const c = new Array(size2).fill(0)
  for (let i = 0; i < size2; i++) {
    for (let j = 0; j < size2 - i; j++) {
      c[i] += b[j] * b[j + i]
    }
  }

  let d = 0
  while (c[d] > c[d + 1]) d++
  let maxval = -1
  let maxpos = -1
  for (let i = d; i < size2; i++) {
    if (c[i] > maxval) {
      maxval = c[i]
      maxpos = i
    }
  }
  if (maxpos <= 0) return -1

  let T0 = maxpos
  const x1 = c[T0 - 1]
  const x2 = c[T0]
  const x3 = c[T0 + 1]
  const a = (x1 + x3 - 2 * x2) / 2
  const bb = (x3 - x1) / 2
  if (a) T0 = T0 - bb / (2 * a)

  return sampleRate / T0
}

export type PitchState = {
  listening: boolean
  freq: number
  key: PianoKey | null
  error: string | null
}

type UsePitchDetectionOptions = {
  /** called once per newly stabilized note */
  onNote?: (key: PianoKey) => void
}

export function usePitchDetection({ onNote }: UsePitchDetectionOptions = {}) {
  const [state, setState] = useState<PitchState>({
    listening: false,
    freq: 0,
    key: null,
    error: null,
  })

  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const bufRef = useRef<Float32Array | null>(null)
  const lastNoteRef = useRef<string | null>(null)
  const stableCountRef = useRef(0)

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null
    lastNoteRef.current = null
    stableCountRef.current = 0
    setState((s) => ({ ...s, listening: false, freq: 0, key: null }))
  }, [])

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({ ...s, error: '이 브라우저는 마이크 입력을 지원하지 않습니다.' }))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx: AudioContext = ctxRef.current ?? new Ctx()
      ctxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      setState((s) => ({ ...s, listening: true, error: null }))

      const tick = () => {
        const an = analyserRef.current
        const buf = bufRef.current
        if (!an || !buf || !ctxRef.current) return
        an.getFloatTimeDomainData(buf)
        const freq = autoCorrelate(buf, ctxRef.current.sampleRate)
        if (freq > 0) {
          const match = frequencyToKey(freq)
          setState((s) => ({ ...s, freq, key: match?.key ?? null }))
          // register a note once it stays stable for a few frames
          if (match && match.cents < 45) {
            if (lastNoteRef.current === match.key.id) {
              stableCountRef.current += 1
              if (stableCountRef.current === 4) onNote?.(match.key)
            } else {
              lastNoteRef.current = match.key.id
              stableCountRef.current = 1
            }
          }
        } else {
          lastNoteRef.current = null
          stableCountRef.current = 0
          setState((s) => (s.freq === 0 && !s.key ? s : { ...s, freq: 0, key: null }))
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setState((s) => ({ ...s, error: '마이크 접근이 거부되었습니다.', listening: false }))
    }
  }, [onNote])

  const toggle = useCallback(() => {
    if (state.listening) stop()
    else void start()
  }, [state.listening, start, stop])

  useEffect(() => () => stop(), [stop])

  return { ...state, start, stop, toggle }
}
