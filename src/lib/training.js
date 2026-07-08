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
export function estimateVolume(exercises) {
  let total = 0
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      const w = Number(s.weight) || 0
      const r = Number(s.reps) || 0
      total += w * r
    }
  }
  return Math.round(total)
}

// Best estimated 1RM per exercise across all history — for the PR board.
export function personalRecords(history) {
  const map = {}
  for (const session of history || []) {
    for (const ex of session.exercises || []) {
      for (const s of ex.sets || []) {
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
