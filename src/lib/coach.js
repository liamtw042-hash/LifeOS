// LifeOS — Phase 3 coaching insights.
// generateCoachInsights is fully defensive: bad/missing input must never throw.
// Returns an array of { icon, tone:'good'|'warn'|'info', text }.

const MAJOR_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']

// Map a specific exercise muscle (e.g. "Upper Chest", "Rear Delts") to a major group.
function toGroup(muscle) {
  const m = String(muscle || '').toLowerCase()
  if (/chest|pec/.test(m)) return 'Chest'
  if (/lat|mid back|\bback\b|trap|rhom/.test(m)) return 'Back'
  if (/quad|ham|glute|calf|calv|\bleg/.test(m)) return 'Legs'
  if (/delt|shoulder/.test(m)) return 'Shoulders'
  if (/bicep|tricep|forearm|brachi|\barm/.test(m)) return 'Arms'
  return null
}

function daysAgo(dateStr, today) {
  const a = new Date(String(dateStr) + 'T00:00:00')
  const b = new Date(String(today) + 'T00:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Infinity
  return Math.round((b - a) / 86400000)
}

function shiftDate(dateStr, days) {
  const d = new Date(String(dateStr) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function generateCoachInsights({
  todayFoodLog,
  targets,
  sessions,
  weights,
  habits,
  today,
} = {}) {
  const t = today || (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const insights = []

  try {
    // 1) Protein gap
    const targetP = Number(targets?.protein) || 0
    const loggedP = (todayFoodLog?.items || []).reduce(
      (a, it) => a + (Number(it.p) || 0),
      0
    )
    if (targetP > 0 && loggedP < 0.8 * targetP) {
      insights.push({
        icon: '🥩',
        tone: 'warn',
        text: `You're ${Math.round(targetP - loggedP)}g short of your protein target (${Math.round(loggedP)}/${Math.round(targetP)} g).`,
      })
    }

    // 2) Muscle groups not trained recently
    const list = Array.isArray(sessions) ? sessions : []
    if (list.length) {
      const lastByGroup = {}
      for (const s of list) {
        const d = daysAgo(s?.date, t)
        for (const ex of s?.exercises || []) {
          const g = toGroup(ex?.muscle)
          if (!g) continue
          if (lastByGroup[g] === undefined || d < lastByGroup[g]) lastByGroup[g] = d
        }
      }
      for (const g of MAJOR_GROUPS) {
        const d = lastByGroup[g]
        if (d === undefined || d === Infinity) continue // never trained — skip to avoid noise
        if (d > 7) {
          insights.push({
            icon: '⏳',
            tone: 'info',
            text: `Haven't trained ${g} in ${d} days.`,
          })
        }
      }
    }

    // 3) Weight trend over ~14 days
    const ws = (Array.isArray(weights) ? weights : [])
      .map((w) => ({ v: Number(w?.value) || 0, d: w?.date }))
      .filter((w) => w.v > 0 && w.d)
      .sort((a, b) => String(a.d).localeCompare(String(b.d)))
    const recent = ws.filter((w) => daysAgo(w.d, t) <= 16)
    if (recent.length >= 2) {
      const first = recent[0]
      const last = recent[recent.length - 1]
      const change = last.v - first.v
      const abs = Math.abs(change)
      const goal = targets?.goal
      if (abs < 0.3) {
        insights.push({
          icon: '⚖️',
          tone: 'info',
          text: `Weight's been flat for 2 weeks (${last.v.toFixed(1)}kg).`,
        })
      } else {
        const dir = change < 0 ? 'down' : 'up'
        let tone = 'info'
        if (goal === 'cut') tone = change < 0 ? 'good' : 'warn'
        else if (goal === 'bulk') tone = change > 0 ? 'good' : 'warn'
        insights.push({
          icon: change < 0 ? '📉' : '📈',
          tone,
          text: `Weight trending ${dir} ${abs.toFixed(1)}kg over 2 weeks.`,
        })
      }
    }

    // 4) Recent PRs
    const prNames = []
    for (const s of list) {
      if (daysAgo(s?.date, t) <= 7) {
        for (const n of s?.prs || []) {
          if (n && !prNames.includes(n)) prNames.push(n)
        }
      }
    }
    if (prNames.length) {
      insights.push({
        icon: '🏆',
        tone: 'good',
        text: `New PR this week: ${prNames.slice(0, 3).join(', ')}.`,
      })
    }

    // 5) Low sleep
    const sleepHabit = (Array.isArray(habits) ? habits : []).find((h) =>
      /sleep/i.test(String(h?.name || ''))
    )
    if (sleepHabit) {
      const comp = sleepHabit.completions || []
      const last3 = [0, 1, 2].map((i) => shiftDate(t, -i))
      const done3 = last3.filter((d) => comp.includes(d)).length
      const doneToday = comp.includes(t)
      if (!doneToday || done3 <= 1) {
        insights.push({
          icon: '😴',
          tone: 'warn',
          text: `Sleep's slipped — you logged sleep only ${done3} of the last 3 days.`,
        })
      }
    }

    // Always surface at least one positive
    if (!insights.some((i) => i.tone === 'good')) {
      const workoutsThisWeek = list.filter((s) => daysAgo(s?.date, t) <= 7).length
      if (workoutsThisWeek > 0) {
        insights.unshift({
          icon: '💪',
          tone: 'good',
          text: `${workoutsThisWeek} workout${workoutsThisWeek > 1 ? 's' : ''} logged this week — keep the momentum.`,
        })
      } else {
        insights.unshift({
          icon: '✨',
          tone: 'good',
          text: 'Fresh slate — log a workout or a meal to get rolling.',
        })
      }
    }
  } catch (e) {
    // Never throw from the coach.
    if (!insights.length) {
      insights.push({ icon: '✨', tone: 'info', text: 'Keep logging — insights appear as data builds up.' })
    }
  }

  return insights.slice(0, 5)
}

export default generateCoachInsights
