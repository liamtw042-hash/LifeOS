import React, { useEffect, useRef, useState } from 'react'

const COLOR = '#7C3AED'

function fmt(s) {
  const sec = Math.max(0, Math.round(s))
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

// Countdown rest timer with a progress ring, +15/-15s, skip and a finish flash.
export default function RestTimer({ seconds = 60, onDone, onClose }) {
  const [total, setTotal] = useState(Math.max(5, Number(seconds) || 60))
  const [remaining, setRemaining] = useState(Math.max(5, Number(seconds) || 60))
  const [flash, setFlash] = useState(false)
  const doneRef = useRef(false)
  const intervalRef = useRef(null)

  // Countdown loop
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) return 0
        return r - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Fire completion once when we hit zero
  useEffect(() => {
    if (remaining <= 0 && !doneRef.current) {
      doneRef.current = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([200, 100, 200])
        }
      } catch (e) {
        /* vibrate unsupported — ignore */
      }
      setFlash(true)
      if (onDone) onDone()
      const t = setTimeout(() => setFlash(false), 900)
      return () => clearTimeout(t)
    }
  }, [remaining, onDone])

  function adjust(delta) {
    doneRef.current = false
    setRemaining((r) => Math.max(1, r + delta))
    setTotal((t) => Math.max(1, t + Math.max(0, delta)))
  }

  const size = 180
  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const offset = circ * (1 - pct)
  const finished = remaining <= 0

  return (
    <div className="flex flex-col items-center py-2">
      <div
        className={`relative ${flash ? 'animate-checkmark' : ''}`}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={finished ? '#10B981' : COLOR}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
              filter: `drop-shadow(0 0 8px ${finished ? '#10B981' : COLOR}90)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-black tabular-nums leading-none"
            style={{ color: finished ? '#10B981' : '#fff' }}
          >
            {finished ? 'Rest done' : fmt(remaining)}
          </span>
          <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mt-1.5">
            {finished ? 'Next set' : 'Rest'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-5 w-full">
        <button
          onClick={() => adjust(-15)}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold text-white/70 bg-white/5 border border-white/10"
        >
          −15s
        </button>
        <button
          onClick={() => adjust(15)}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold text-white/70 bg-white/5 border border-white/10"
        >
          +15s
        </button>
        <button
          onClick={onClose}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: COLOR, boxShadow: `0 0 18px ${COLOR}55` }}
        >
          {finished ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
