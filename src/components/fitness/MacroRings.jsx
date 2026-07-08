import React from 'react'

const RING_META = [
  { key: 'cal', label: 'Calories', color: '#7C3AED', unit: '' },
  { key: 'p', label: 'Protein', color: '#06B6D4', unit: 'g' },
  { key: 'c', label: 'Carbs', color: '#F97316', unit: 'g' },
  { key: 'f', label: 'Fat', color: '#EAB308', unit: 'g' },
]

function Ring({ label, color, current, target, unit }) {
  const size = 76
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const safeTarget = target > 0 ? target : 1
  const pct = Math.max(0, Math.min(1, current / safeTarget))
  const offset = circ * (1 - pct)
  const over = current > target && target > 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
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
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.6s ease',
              filter: `drop-shadow(0 0 5px ${color}80)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black leading-none" style={{ color: over ? '#EF4444' : '#ffffff' }}>
            {Math.round(current)}
          </span>
          <span className="text-[9px] text-white/35 leading-none mt-0.5">
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
      {RING_META.map((m) => (
        <Ring
          key={m.key}
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
