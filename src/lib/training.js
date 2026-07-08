// LifeOS — Phase 2 Training pure helpers.
// All functions are defensive: bad/missing input should never throw.

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Day-of-week key ('Mon'..'Sun') for a given date (defaults to now).
export function todayDayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const idx = Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay()
  return DAY_KEYS[idx] || 'Mon'
}

// Estimated 1-rep-max via the Epley formula, rounded to nearest kg.
export function epley1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return Math.round(w)
  return Math.round(w * (1 + r / 30))
}

// Working-weight table across common %1RM training zones.
export function workingWeights(oneRM) {
  const max = Number(oneRM) || 0
  const pcts = [
    { pct: 60, reps: '12–15', label: 'Endurance' },
    { pct: 70, reps: '10–12', label: 'Hypertrophy' },
    { pct: 80, reps: '6–8', label: 'Strength' },
    { pct: 90, reps: '3–5', label: 'Power' },
  ]
  return pcts.map((p) => ({
    ...p,
    weight: Math.round((max * p.pct) / 100 / 0.5) * 0.5, // nearest 0.5kg
  }))
}

// Auto-progression: if the last set hit the top of the rep range, add a small
// increment; otherwise keep the same weight. Compound gets +2.5kg, isolation +1kg.
export function suggestNextWeight(lastWeight, lastReps, repHigh, type = 'compound') {
  const w = Number(lastWeight) || 0
  const r = Number(lastReps) || 0
  const high = Number(repHigh) || 0
  if (w <= 0) return 0
  if (high > 0 && r >= high) {
    const inc = type === 'compound' ? 2.5 : 1
    return Math.round((w + inc) * 2) / 2 // nearest 0.5kg
  }
  return w
}

// Is this (weight, reps) a personal record for `name` vs everything in history?
// history = array of workoutSessions docs. PR if the estimated 1RM beats all
// prior sets for that exercise (also treats first-ever set as a PR).
export function isPR(name, weight, reps, history, requirePrior = false) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return false
  const target = epley1RM(w, r)
  let best = 0
  let seen = false
  for (const session of history || []) {
    for (const ex of session.exercises || []) {
      if (ex.name !== name) continue
      for (const s of ex.sets || []) {
        if (s.warmup) continue
        const est = epley1RM(s.weight, s.reps)
        if (est > 0) {
          seen = true
          if (est > best) best = est
        }
      }
    }
  }
  if (!seen) return requirePrior ? false : true
  return target > best
}

// Total volume = sum(weight * reps) across every set of every exercise.
// Warmup sets (s.warmup === true) never count toward volume.
export function estimateVolume(exercises) {
  let total = 0
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      if (s.warmup) continue
      const w = Number(s.weight) || 0
      const r = Number(s.reps) || 0
      total += w * r
    }
  }
  return Math.round(total)
}

// Standard kg plates available per side, heaviest first.
export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]

// Plate loading for a barbell: how to load ONE side to reach `target` total.
// Returns { perSide:[{plate,count}], loadedTotal, leftover, bar }.
export function plateBreakdown(target, bar = 20, plates = KG_PLATES) {
  const t = Number(target) || 0
  const b = Number(bar) || 0
  const perSideWeight = (t - b) / 2
  const out = { perSide: [], loadedTotal: b, leftover: 0, bar: b, belowBar: false }
  if (perSideWeight <= 0) {
    // Target is below the bar weight — nothing can be loaded.
    if (t > 0 && t < b) {
      out.loadedTotal = 0
      out.leftover = t
      out.belowBar = true
    }
    return out
  }
  let remaining = perSideWeight
  for (const p of plates) {
    let count = 0
    while (remaining >= p - 1e-9) {
      remaining -= p
      count += 1
    }
    if (count > 0) out.perSide.push({ plate: p, count })
  }
  const loadedPerSide = perSideWeight - remaining
  out.loadedTotal = Math.round((b + loadedPerSide * 2) * 100) / 100
  out.leftover = Math.round(remaining * 2 * 100) / 100 // total weight still short
  return out
}

// Warmup ramp for a given working weight. Returns tappable warmup set rows.
// Percentages scale up to the work set; empty-bar / light first set included.
export function warmupSets(workingWeight, type = 'compound') {
  const w = Number(workingWeight) || 0
  if (w <= 0) return []
  const steps =
    type === 'compound'
      ? [
          { pct: 0, reps: 10, label: 'Bar' },
          { pct: 40, reps: 8 },
          { pct: 60, reps: 5 },
          { pct: 80, reps: 3 },
        ]
      : [
          { pct: 50, reps: 12 },
          { pct: 75, reps: 8 },
        ]
  return steps.map((s) => ({
    weight: s.pct === 0 ? 0 : Math.round((w * s.pct) / 100 / 0.5) * 0.5,
    reps: s.reps,
    pct: s.pct,
    label: s.label || `${s.pct}%`,
  }))
}

// Best estimated 1RM per exercise across all history — for the PR board.
export function personalRecords(history) {
  const map = {}
  for (const session of history || []) {
    for (const ex of session.exercises || []) {
      for (const s of ex.sets || []) {
        if (s.warmup) continue
        const est = epley1RM(s.weight, s.reps)
        if (est <= 0) continue
        const prev = map[ex.name]
        if (!prev || est > prev.est1RM) {
          map[ex.name] = {
            name: ex.name,
            muscle: ex.muscle || '',
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
            est1RM: est,
            date: session.date || '',
          }
        }
      }
    }
  }
  return Object.values(map).sort((a, b) => b.est1RM - a.est1RM)
}

// Flat list of past sets for a single exercise, newest session first.
export function exerciseHistory(name, history) {
  const out = []
  const sorted = [...(history || [])].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  )
  for (const session of sorted) {
    for (const ex of session.exercises || []) {
      if (ex.name !== name) continue
      const sets = (ex.sets || []).filter((s) => Number(s.weight) || Number(s.reps))
      if (sets.length) {
        out.push({ date: session.date || '', day: session.day || '', sets })
      }
    }
  }
  return out
}

// Most recent logged sets for an exercise (for "last session" reference).
export function lastSessionSets(name, history) {
  const hist = exerciseHistory(name, history)
  return hist.length ? hist[0].sets : null
}

// The single set with the highest estimated 1RM (warmups excluded).
export function bestSet(sets) {
  let best = null
  for (const s of sets || []) {
    if (s && s.warmup) continue
    if (!best || epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps)) best = s
  }
  return best
}

// Chronological feed of personal records logged across sessions.
// Each session stores `prs` as an array of exercise names; we pair each name
// with the top set for that exercise in that session. Newest first.
export function prTimeline(history) {
  const out = []
  for (const session of history || []) {
    const names = Array.isArray(session?.prs) ? session.prs : []
    if (!names.length) continue
    for (const name of names) {
      const ex = (session.exercises || []).find((e) => e && e.name === name)
      const ref = ex ? bestSet(ex.sets) : null
      const weight = ref ? Number(ref.weight) || 0 : 0
      const reps = ref ? Number(ref.reps) || 0 : 0
      out.push({
        name: name || 'Exercise',
        muscle: ex?.muscle || '',
        date: session.date || '',
        day: session.day || '',
        weight,
        reps,
        est1RM: epley1RM(weight, reps),
      })
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

// Linear-regression projection of bodyweight toward a goal.
// weights: [{ date:'YYYY-MM-DD', value:<kg> }]; goalKg in kg; windowDays lookback.
// today defaults to now. All maths in kg — callers format for display.
// Returns { ok, current, slopePerDay, remaining, direction, status, etaDate, points }.
//   status: 'insufficient' | 'reached' | 'flat' | 'away' | 'projecting'
export function weightProjection(weights, goalKg, windowDays = 30, today = new Date()) {
  const goal = Number(goalKg)
  const base = today instanceof Date ? new Date(today) : new Date(today)
  base.setHours(0, 0, 0, 0)
  const msDay = 86400000
  const clean = (Array.isArray(weights) ? weights : [])
    .map((w) => {
      const d = new Date(String(w?.date) + 'T00:00:00')
      return { t: d.getTime(), v: Number(w?.value) || 0, date: w?.date }
    })
    .filter((w) => Number.isFinite(w.t) && w.v > 0)
    .sort((a, b) => a.t - b.t)
  const cutoff = base.getTime() - windowDays * msDay
  const pts = clean.filter((w) => w.t >= cutoff)
  const current = clean.length ? clean[clean.length - 1].v : null

  if (!Number.isFinite(goal) || goal <= 0 || pts.length < 2) {
    return { ok: false, current, slopePerDay: null, remaining: null, direction: null, status: 'insufficient', etaDate: null, points: pts.length }
  }

  // Regress value against days-since-first-point.
  const x0 = pts[0].t
  const xs = pts.map((p) => (p.t - x0) / msDay)
  const ys = pts.map((p) => p.v)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  const slope = den === 0 ? 0 : num / den // kg per day
  const intercept = my - slope * mx

  const cur = current
  const remaining = cur - goal // >0 means need to lose, <0 means need to gain
  const direction = slope < 0 ? 'down' : slope > 0 ? 'up' : 'flat'

  if (Math.abs(remaining) < 0.1) {
    return { ok: true, current: cur, slopePerDay: slope, remaining, direction, status: 'reached', etaDate: null, points: n }
  }
  if (Math.abs(slope) < 0.005) { // < ~35g/week — effectively flat
    return { ok: true, current: cur, slopePerDay: slope, remaining, direction: 'flat', status: 'flat', etaDate: null, points: n }
  }
  const needToLose = remaining > 0
  const movingToward = needToLose ? slope < 0 : slope > 0
  if (!movingToward) {
    return { ok: true, current: cur, slopePerDay: slope, remaining, direction, status: 'away', etaDate: null, points: n }
  }
  // Solve regression line for goal: goal = intercept + slope * x  → x days from first point.
  const xGoal = (goal - intercept) / slope
  const etaMs = x0 + xGoal * msDay
  let etaDate = new Date(etaMs)
  if (etaDate.getTime() < base.getTime()) etaDate = base // never project into the past
  return { ok: true, current: cur, slopePerDay: slope, remaining, direction, status: 'projecting', etaDate, points: n }
}
