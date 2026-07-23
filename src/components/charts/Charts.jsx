import React, { useId, useMemo, useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart as RAreaChart,
  Area,
  BarChart as RBarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  RadarChart as RRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'

// LifeOS — theme-consistent charts (Recharts internals, HUD styling).
// Mobile-first, responsive, animated on load, and defensive: empty / malformed
// / all-zero data renders a graceful "No data yet" state instead of throwing.

const ACCENT = '#7C3AED'
const GRID = 'rgba(255,255,255,0.08)'
const LABEL = 'rgba(255,255,255,0.42)'

const nn = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}
const round = (x) => Math.round(nn(x))
const safeId = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '')

function EmptyState({ height = 120, label = 'No data yet' }) {
  return (
    <div
      className="flex items-center justify-center readout text-xs font-medium text-white/30 tracking-wide"
      style={{ height }}
    >
      {label}
    </div>
  )
}

/* ---------------- Dark-glass tooltip ---------------- */
function HudTooltip({ active, payload, label, color = ACCENT, suffix = '' }) {
  if (!active || !Array.isArray(payload) || !payload.length) return null
  return (
    <div
      style={{
        background: 'rgba(12,14,21,0.86)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '6px 10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      {label != null && label !== '' && (
        <div style={{ fontSize: 10, color: LABEL, marginBottom: 3 }}>{label}</div>
      )}
      {payload.map((p, i) => {
        const c = p.color || p.stroke || color
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: c,
                boxShadow: `0 0 6px ${c}`,
                flex: '0 0 auto',
              }}
            />
            <span className="readout" style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
              {round(p.value)}
              {suffix}
            </span>
            {p.name && p.name !== 'value' && (
              <span style={{ fontSize: 10, color: LABEL }}>{p.name}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const axisXProps = {
  tick: { fontSize: 9, fill: LABEL },
  tickLine: false,
  axisLine: { stroke: GRID },
  interval: 'preserveStartEnd',
  minTickGap: 16,
  height: 16,
}
const axisYProps = {
  tick: { fontSize: 9, fill: LABEL },
  tickLine: false,
  axisLine: false,
  width: 28,
  tickCount: 3,
}

/* ---------------- LineChart ---------------- */
// data = [{ label, value }]; optional dashed horizontal `target` line.
export function LineChart({ data, color = ACCENT, height = 140, yLabel, target }) {
  const rid = safeId(useId())
  const rows = (Array.isArray(data) ? data : [])
    .filter((d) => d && d.value != null && Number.isFinite(Number(d.value)))
    .map((d) => ({ label: d.label ?? '', value: nn(d.value) }))
  const hasSignal = rows.some((d) => d.value !== 0)

  const domain = useMemo(() => {
    if (!rows.length) return [0, 1]
    let lo = Math.min(...rows.map((r) => r.value))
    let hi = Math.max(...rows.map((r) => r.value))
    if (target != null) {
      lo = Math.min(lo, nn(target))
      hi = Math.max(hi, nn(target))
    }
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.12
    return [lo - pad, hi + pad]
  }, [rows, target])

  if (!rows.length || !hasSignal) return <EmptyState height={height} />

  const gid = `line-grad-${rid}`
  return (
    <div className="hud-chart" style={{ color, position: 'relative', width: '100%' }}>
      {yLabel && (
        <span
          className="readout"
          style={{ position: 'absolute', top: 0, left: 2, fontSize: 9, color: LABEL, zIndex: 1 }}
        >
          {yLabel}
        </span>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RAreaChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisXProps} />
          <YAxis domain={domain} {...axisYProps} />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.35, strokeDasharray: '3 3' }}
            content={<HudTooltip color={color} />}
          />
          {target != null && (
            <ReferenceLine
              y={nn(target)}
              stroke={color}
              strokeDasharray="4 3"
              strokeOpacity={0.6}
              label={{ value: round(target), fill: LABEL, fontSize: 9, position: 'right' }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gid})`}
            isAnimationActive
            animationDuration={300}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: '#0b0d14', strokeWidth: 1 }}
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- BarChart ---------------- */
// data = [{ label, value }]; optional dashed `target` line.
export function BarChart({ data, color = ACCENT, height = 140, target }) {
  const rid = safeId(useId())
  const rows = (Array.isArray(data) ? data : [])
    .filter((d) => d && d.value != null && Number.isFinite(Number(d.value)))
    .map((d) => ({ label: d.label ?? '', value: nn(d.value) }))
  const hasSignal = rows.some((d) => d.value !== 0)

  const maxV = useMemo(() => {
    const m = Math.max(...rows.map((r) => r.value), target != null ? nn(target) : 0, 1)
    return Math.ceil(m * 1.12)
  }, [rows, target])

  if (!rows.length || !hasSignal) return <EmptyState height={height} />

  return (
    <div className="hud-chart" style={{ color, width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <RBarChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisXProps} />
          <YAxis domain={[0, maxV]} {...axisYProps} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<HudTooltip color={color} />} />
          {target != null && (
            <ReferenceLine
              y={nn(target)}
              stroke={color}
              strokeDasharray="4 3"
              strokeOpacity={0.65}
              label={{ value: round(target), fill: LABEL, fontSize: 9, position: 'right' }}
            />
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={300}>
            {rows.map((r, i) => (
              <Cell key={i} fill={color} fillOpacity={i === rows.length - 1 ? 1 : 0.62} />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- Heatmap (themed SVG) ---------------- */
// days = array/map of { date:'YYYY-MM-DD', level: 0..4 }.
// Renders `weeks` columns × 7 rows, most recent at right (GitHub style).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Heatmap({ days, color = ACCENT, weeks = 16 }) {
  const rid = safeId(useId())
  const wk = Math.max(1, Math.min(53, Number(weeks) || 16))

  const geom = useMemo(() => {
    const map = {}
    const list = Array.isArray(days) ? days : days && typeof days === 'object' ? Object.values(days) : []
    for (const d of list) {
      if (d && d.date != null) map[String(d.date)] = Math.max(0, Math.min(4, Math.round(nn(d.level))))
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayDow = today.getDay()
    const totalDays = wk * 7
    const start = new Date(today)
    start.setDate(start.getDate() - (totalDays - 1))
    start.setDate(start.getDate() - start.getDay())
    const cells = []
    const cols = wk + 1
    const monthLabels = []
    let lastMonth = -1
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 7; r++) {
        const d = new Date(start)
        d.setDate(d.getDate() + c * 7 + r)
        if (d > today) continue
        const key = localKey(d)
        const level = map[key] || 0
        cells.push({ c, r, level, key })
        if (r === 0) {
          const m = d.getMonth()
          if (m !== lastMonth) { monthLabels.push({ c, m }); lastMonth = m }
        }
      }
    }
    return { cells, cols, monthLabels, todayDow }
  }, [days, wk])

  if (!geom.cells.length) return <EmptyState height={100} />

  const cell = 12
  const gap = 3
  const left = 18
  const top = 12
  const W = left + geom.cols * (cell + gap)
  const H = top + 7 * (cell + gap)
  const dayHints = ['', 'M', '', 'W', '', 'F', '']
  const gid = `hm-glow-${rid}`
  const shade = (lvl) => (lvl <= 0 ? 'rgba(255,255,255,0.05)' : color)
  const op = (lvl) => (lvl <= 0 ? 1 : 0.3 + lvl * 0.175) // 0.475..1

  return (
    <div style={{ overflowX: 'auto' }} className="no-scrollbar">
      <svg viewBox={`0 0 ${W} ${H}`} width={Math.max(W, 300)} height={H} role="img">
        <defs>
          <filter id={gid} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {geom.monthLabels.map((ml, i) => (
          <text key={i} x={left + ml.c * (cell + gap)} y={8} fontSize="7" fill={LABEL}>{MONTHS[ml.m]}</text>
        ))}
        {dayHints.map((h, r) =>
          h ? (
            <text key={r} x="0" y={top + r * (cell + gap) + cell - 2} fontSize="7" fill={LABEL}>{h}</text>
          ) : null
        )}
        {geom.cells.map((c, i) => (
          <rect
            key={i}
            x={left + c.c * (cell + gap)}
            y={top + c.r * (cell + gap)}
            width={cell}
            height={cell}
            rx="2"
            fill={shade(c.level)}
            opacity={op(c.level)}
            filter={c.level > 0 ? `url(#${gid})` : undefined}
          />
        ))}
      </svg>
    </div>
  )
}

/* ---------------- Donut (glowing arc ring) ---------------- */
// Donut({ value, max, label, color, size })
export function Donut({ value, max, label, color = ACCENT, size = 120 }) {
  const rid = safeId(useId())
  const v = nn(value)
  const m = nn(max)
  const safeMax = m > 0 ? m : 0
  const pct = safeMax > 0 ? Math.max(0, Math.min(1, v / safeMax)) : 0
  const stroke = Math.max(6, Math.round(size * 0.09))
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  const empty = safeMax <= 0

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const gid = `dn-glow-${rid}`
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <filter id={gid} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          {!empty && (
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
              filter={`url(#${gid})`}
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {empty ? (
            <span className="text-xs text-white/30 font-semibold">No data</span>
          ) : (
            <>
              <span
                className="readout font-bold leading-none"
                style={{ fontSize: size * 0.24, color: '#fff', textShadow: `0 0 12px ${color}66` }}
              >
                {Math.round(pct * 100)}
                <span style={{ fontSize: size * 0.13 }}>%</span>
              </span>
              {label && (
                <span className="text-[10px] uppercase tracking-wide text-white/45 mt-1 text-center px-1">
                  {label}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- RadarChart (Recharts Radar) ---------------- */
// RadarChart({ data:[{axis,value,max}], color })
export function RadarChart({ data, color = ACCENT }) {
  const rows = (Array.isArray(data) ? data : [])
    .filter((d) => d && d.axis != null)
    .map((d) => ({ axis: String(d.axis), value: nn(d.value), max: nn(d.max) }))
  const hasSignal = rows.some((d) => d.value !== 0)

  if (rows.length < 3 || !hasSignal) {
    return <EmptyState height={200} label={rows.length < 3 ? 'Not enough data' : 'No data yet'} />
  }

  // Normalize each axis to a common 0..100 scale (per-axis max).
  const norm = rows.map((d) => ({
    axis: d.axis,
    value: d.max > 0 ? Math.round((d.value / d.max) * 100) : 0,
  }))

  return (
    <div className="hud-chart" style={{ color, width: '100%' }}>
      <ResponsiveContainer width="100%" height={220}>
        <RRadarChart data={norm} outerRadius="70%" margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: LABEL }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.22}
            isAnimationActive
            animationDuration={400}
          />
          <Tooltip content={<HudTooltip color={color} suffix="%" />} />
        </RRadarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- Sparkline (tiny inline trend) ---------------- */
// Sparkline({ data:[numbers], color, width, height })
export function Sparkline({ data, color = ACCENT, width = 100, height = 28 }) {
  const rid = safeId(useId())
  const vals = (Array.isArray(data) ? data : []).map(nn).filter((v) => Number.isFinite(v))

  if (vals.length < 2 || vals.every((v) => v === 0)) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1="2"
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.4"
          strokeDasharray="3 3"
        />
      </svg>
    )
  }

  const pad = 2
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const x = (i) => pad + (i / (vals.length - 1)) * (width - 2 * pad)
  const y = (v) => pad + (1 - (v - min) / range) * (height - 2 * pad)
  const linePath = vals.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(vals.length - 1).toFixed(1)} ${height - pad} L ${x(0).toFixed(1)} ${height - pad} Z`
  const gid = `sl-grad-${rid}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 2px ${color}aa)` }}
      />
      <circle
        cx={x(vals.length - 1)}
        cy={y(vals[vals.length - 1])}
        r="1.8"
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  )
}

/* ---------------- AreaChartStacked (stacked area) ---------------- */
// AreaChartStacked({ data, series:[{key,color,label}], height })
export function AreaChartStacked({ data, series, height = 160 }) {
  const rid = safeId(useId())
  const rows = Array.isArray(data) ? data : []
  const ser = (Array.isArray(series) ? series : []).filter((s) => s && s.key)
  const hasSignal = rows.length > 0 && ser.some((s) => rows.some((r) => nn(r[s.key]) !== 0))

  if (!rows.length || !ser.length || !hasSignal) return <EmptyState height={height} />

  const defs = ser.map((s) => ({
    ...s,
    gid: `as-${rid}-${safeId(s.key)}`,
    col: s.color || ACCENT,
  }))

  return (
    <div style={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <RAreaChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            {defs.map((s) => (
              <linearGradient key={s.key} id={s.gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.col} stopOpacity="0.5" />
                <stop offset="100%" stopColor={s.col} stopOpacity="0.05" />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisXProps} />
          <YAxis {...axisYProps} />
          <Tooltip content={<HudTooltip />} />
          {defs.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label || s.key}
              stackId="1"
              stroke={s.col}
              strokeWidth={1.5}
              fill={`url(#${s.gid})`}
              isAnimationActive
              animationDuration={350}
            />
          ))}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default { LineChart, BarChart, Heatmap, Donut, RadarChart, Sparkline, AreaChartStacked }
