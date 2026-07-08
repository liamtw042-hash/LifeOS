import React, { useMemo } from 'react'

// LifeOS — dependency-free, theme-consistent inline-SVG charts.
// Mobile-first, responsive via viewBox. Purple accent, muted gridlines.
// Every component is defensive: empty / malformed data never throws.

const ACCENT = '#7C3AED'
const GRID = 'rgba(255,255,255,0.08)'
const LABEL = 'rgba(255,255,255,0.4)'

const nn = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}
const round = (x) => Math.round(nn(x))

function EmptyState({ height = 120, label = 'No data yet' }) {
  return (
    <div
      className="flex items-center justify-center text-xs font-semibold text-white/30"
      style={{ height }}
    >
      {label}
    </div>
  )
}

/* ---------------- LineChart ---------------- */
// data = [{ label, value }]; optional dashed horizontal `target` line.
export function LineChart({ data, color = ACCENT, height = 140, yLabel, target }) {
  const pts = Array.isArray(data) ? data.filter((d) => d && d.value != null) : []

  const geom = useMemo(() => {
    if (!pts.length) return null
    const W = 320
    const H = 140
    const padL = 30
    const padR = 8
    const padT = 12
    const padB = 20
    const values = pts.map((d) => nn(d.value))
    let min = Math.min(...values, target != null ? nn(target) : Infinity)
    let max = Math.max(...values, target != null ? nn(target) : -Infinity)
    if (!Number.isFinite(min)) min = 0
    if (!Number.isFinite(max)) max = 0
    if (min === max) { min -= 1; max += 1 }
    const range = max - min
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    const x = (i) => padL + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW)
    const y = (v) => padT + innerH - ((nn(v) - min) / range) * innerH
    const coords = pts.map((d, i) => ({ x: x(i), y: y(d.value), v: nn(d.value), label: d.label }))
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
    const targetY = target != null ? y(target) : null
    return { W, H, padL, padT, innerH, padB, min, max, coords, linePath, areaPath, targetY }
  }, [pts, target])

  if (!geom) return <EmptyState height={height} />

  const gid = `lg-${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${geom.W} ${geom.H}`} width="100%" height={height} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* y range labels */}
      <text x="2" y={geom.padT + 4} fontSize="8" fill={LABEL}>{round(geom.max)}</text>
      <text x="2" y={geom.padT + geom.innerH} fontSize="8" fill={LABEL}>{round(geom.min)}</text>
      {yLabel && (
        <text x="2" y={geom.padT + geom.innerH / 2} fontSize="7" fill={LABEL}>{yLabel}</text>
      )}
      {/* baseline */}
      <line x1={geom.padL} y1={geom.padT + geom.innerH} x2={geom.W - 8} y2={geom.padT + geom.innerH} stroke={GRID} strokeWidth="1" />
      {/* target */}
      {geom.targetY != null && (
        <>
          <line x1={geom.padL} y1={geom.targetY} x2={geom.W - 8} y2={geom.targetY} stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
          <text x={geom.W - 8} y={geom.targetY - 3} fontSize="7" fill={LABEL} textAnchor="end">{round(target)}</text>
        </>
      )}
      <path d={geom.areaPath} fill={`url(#${gid})`} />
      <path d={geom.linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {geom.coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={geom.coords.length > 20 ? 1.5 : 2.5} fill={color} />
      ))}
      {/* x labels: first, middle, last to avoid clutter */}
      {geom.coords.map((c, i) => {
        const show = i === 0 || i === geom.coords.length - 1 || (geom.coords.length > 2 && i === Math.floor(geom.coords.length / 2))
        if (!show || !c.label) return null
        const anchor = i === 0 ? 'start' : i === geom.coords.length - 1 ? 'end' : 'middle'
        return (
          <text key={`l${i}`} x={c.x} y={geom.H - 6} fontSize="7" fill={LABEL} textAnchor={anchor}>{c.label}</text>
        )
      })}
    </svg>
  )
}

/* ---------------- BarChart ---------------- */
// data = [{ label, value }]; optional dashed `target` line.
export function BarChart({ data, color = ACCENT, height = 140, target }) {
  const bars = Array.isArray(data) ? data.filter((d) => d && d.value != null) : []

  const geom = useMemo(() => {
    if (!bars.length) return null
    const W = 320
    const H = 140
    const padT = 12
    const padB = 20
    const padL = 4
    const padR = 4
    const values = bars.map((d) => nn(d.value))
    const max = Math.max(...values, target != null ? nn(target) : 0, 1)
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    const slot = innerW / bars.length
    const bw = Math.max(2, Math.min(slot * 0.6, 34))
    const items = bars.map((d, i) => {
      const v = nn(d.value)
      const h = (v / max) * innerH
      return {
        x: padL + slot * i + (slot - bw) / 2,
        y: padT + innerH - h,
        w: bw,
        h: Math.max(0, h),
        v,
        label: d.label,
      }
    })
    const targetY = target != null ? padT + innerH - (nn(target) / max) * innerH : null
    return { W, H, padT, padB, innerH, items, targetY, baseY: padT + innerH }
  }, [bars, target])

  if (!geom) return <EmptyState height={height} />

  return (
    <svg viewBox={`0 0 ${geom.W} ${geom.H}`} width="100%" height={height} preserveAspectRatio="none" role="img">
      <line x1="0" y1={geom.baseY} x2={geom.W} y2={geom.baseY} stroke={GRID} strokeWidth="1" />
      {geom.items.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill={color} opacity={0.55 + 0.45 * (i === geom.items.length - 1 ? 1 : 0.6)} />
      ))}
      {geom.targetY != null && (
        <>
          <line x1="0" y1={geom.targetY} x2={geom.W} y2={geom.targetY} stroke="#F97316" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
          <text x={geom.W - 2} y={geom.targetY - 3} fontSize="7" fill={LABEL} textAnchor="end">{round(target)}</text>
        </>
      )}
      {geom.items.map((b, i) => {
        const show = geom.items.length <= 10 || i === 0 || i === geom.items.length - 1 || i % Math.ceil(geom.items.length / 6) === 0
        if (!show || !b.label) return null
        return (
          <text key={`l${i}`} x={b.x + b.w / 2} y={geom.H - 6} fontSize="7" fill={LABEL} textAnchor="middle">{b.label}</text>
        )
      })}
    </svg>
  )
}

/* ---------------- Heatmap ---------------- */
// days = array/map of { date:'YYYY-MM-DD', level: 0..4 }.
// Renders `weeks` columns × 7 rows, most recent at right (GitHub style).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Heatmap({ days, color = ACCENT, weeks = 16 }) {
  const wk = Math.max(1, Math.min(53, Number(weeks) || 16))

  const geom = useMemo(() => {
    // Build a lookup of date -> level.
    const map = {}
    const list = Array.isArray(days) ? days : days && typeof days === 'object' ? Object.values(days) : []
    for (const d of list) {
      if (d && d.date != null) map[String(d.date)] = Math.max(0, Math.min(4, Math.round(nn(d.level))))
    }
    // Most recent column ends today; align grid so today sits in its weekday row.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayDow = today.getDay() // 0=Sun
    const totalDays = wk * 7
    // start = today - (totalDays-1) days, then back up to the Sunday of that week
    const start = new Date(today)
    start.setDate(start.getDate() - (totalDays - 1))
    start.setDate(start.getDate() - start.getDay()) // to Sunday
    const cells = []
    const cols = wk + 1 // add a buffer column for alignment
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
  const shade = (lvl) => (lvl <= 0 ? 'rgba(255,255,255,0.05)' : color)
  const op = (lvl) => (lvl <= 0 ? 1 : 0.25 + lvl * 0.1875) // 0.4375..1

  return (
    <div style={{ overflowX: 'auto' }} className="no-scrollbar">
      <svg viewBox={`0 0 ${W} ${H}`} width={Math.max(W, 300)} height={H} role="img">
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
          />
        ))}
      </svg>
    </div>
  )
}

export default { LineChart, BarChart, Heatmap }
