import React, { useEffect, useState } from 'react'

const RING_META = [
  { key: 'cal', label: 'Calories', color: '#7C3AED', unit: '' },
  { key: 'p', label: 'Protein', color: '#22D3EE', unit: 'g' },
  { key: 'c', label: 'Carbs', color: '#F97316', unit: 'g' },
  { key: 'f', label: 'Fat', color: '#EAB308', unit: 'g' },
]

function Ring({ label, color, current, target, unit, index = 0 }) {
  const size = 76
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const safeTarget = target > 0 ? target : 1
  const pct = Math.max(0, Math.min(1, current / safeTarget))
  const offset = circ * (1 - pct)
  const over = current > target && target > 0

  // Mount grow animation: start empty, then animate to value.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fid = `mr-glow-${color.replace('#', '')}`

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <filter id={fid} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          {/* luminous progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={mounted ? offset : circ}
            filter={`url(#${fid})`}
            style={{
              transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
              transitionDelay: `${index * 90}ms`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="readout text-sm font-bold leading-none"
            style={{
              color: over ? '#F87171' : '#ffffff',
              textShadow: over ? '0 0 10px rgba(248,113,113,0.5)' : `0 0 10px ${color}66`,
            }}
          >
            {Math.round(current)}
          </span>
          <span className="readout text-[9px] text-white/35 leading-none mt-0.5">
            /{Math.round(target)}{unit}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-white/45 mt-1.5 uppercase tracking-wide">{label}</span>
    </div>
  )
}

export default function MacroRings({ totals = {}, targets = {} }) {
  const cur = {
    cal: Number(totals.cal) || 0,
    p: Number(totals.p) || 0,
    c: Number(totals.c) || 0,
    f: Number(totals.f) || 0,
  }
  const tgt = {
    cal: Number(targets.calories) || 0,
    p: Number(targets.protein) || 0,
    c: Number(targets.carbs) || 0,
    f: Number(targets.fat) || 0,
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {RING_META.map((m, i) => (
        <Ring
          key={m.key}
          index={i}
          label={m.label}
          color={m.color}
          unit={m.unit}
          current={cur[m.key]}
          target={tgt[m.key]}
        />
      ))}
    </div>
  )
}
