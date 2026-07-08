// LifeOS — Achievements & streak badges.
// Pure, fully defensive helpers: bad/missing input must never throw.

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr() {
  return localKey(new Date())
}

// Longest run of consecutive calendar days present in a set of YYYY-MM-DD keys.
function longestConsecutive(dateKeys) {
  const set = new Set((dateKeys || []).filter(Boolean).map(String))
  if (!set.size) return 0
  let best = 0
  for (const key of set) {
    // Only start counting from the beginning of a run.
    const prev = shift(key, -1)
    if (set.has(prev)) continue
    let len = 1
    let cur = key
    while (set.has(shift(cur, 1))) {
      cur = shift(cur, 1)
      len++
    }
    if (len > best) best = len
  }
  return best
}

function shift(dateStr, days) {
  const d = new Date(String(dateStr) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return localKey(d)
}

// Build a badge object with derived `earned` from progress.
function badge(id, icon, title, desc, current, target) {
  const cur = Math.max(0, Number(current) || 0)
  const tgt = Math.max(1, Number(target) || 1)
  return {
    id,
    icon,
    title,
    desc,
    earned: cur >= tgt,
    progress: { current: Math.min(cur, tgt), target: tgt },
  }
}

export function computeAchievements(input) {
  const {
    sessions = [],
    habits = [],
    foodLog = [],
    weights = [],
    journal = [],
  } = input || {}

  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safeHabits = Array.isArray(habits) ? habits : []
  const safeFood = Array.isArray(foodLog) ? foodLog : []
  const safeWeights = Array.isArray(weights) ? weights : []
  const safeJournal = Array.isArray(journal) ? journal : []

  // ---- Workouts ----
  const workoutCount = safeSessions.length

  // ---- PRs ---- (sessions[].prs is an array of exercise names)
  let prCount = 0
  for (const s of safeSessions) prCount += ((s && s.prs) || []).length

  // ---- Habit streak ---- (best consecutive run across any single habit)
  let habitStreak = 0
  for (const h of safeHabits) {
    const run = longestConsecutive((h && h.completions) || [])
    if (run > habitStreak) habitStreak = run
  }

  // ---- Food logged consecutive days ---- (only days with items count)
  const foodDays = safeFood
    .filter((d) => d && Array.isArray(d.items) && d.items.length)
    .map((d) => d.date)
  const foodStreak = longestConsecutive(foodDays)

  // ---- Weigh-ins ----
  const weighCount = safeWeights.length

  // ---- Journal entries ----
  const journalCount = safeJournal.length

  return [
    badge('workout_first', '🏋️', 'First Rep', 'Log your first workout', workoutCount, 1),
    badge('workout_10', '💪', 'Getting Consistent', 'Log 10 workouts', workoutCount, 10),
    badge('workout_50', '🔥', 'Iron Discipline', 'Log 50 workouts', workoutCount, 50),
    badge('pr_first', '⭐', 'Record Breaker', 'Hit your first PR', prCount, 1),
    badge('pr_10', '🏆', 'PR Machine', 'Hit 10 personal records', prCount, 10),
    badge('habit_7', '📅', 'Week Warrior', '7-day habit streak', habitStreak, 7),
    badge('habit_30', '🗓️', 'Habit Master', '30-day habit streak', habitStreak, 30),
    badge('food_7', '🍽️', 'Tracked Week', 'Log food 7 days in a row', foodStreak, 7),
    badge('weigh_first', '⚖️', 'On the Scale', 'Log your first weigh-in', weighCount, 1),
    badge('weigh_10', '📊', 'Trend Setter', 'Log 10 weigh-ins', weighCount, 10),
    badge('journal_first', '📓', 'Dear Diary', 'Write your first journal entry', journalCount, 1),
    badge('journal_7', '✍️', 'Reflective', 'Write 7 journal entries', journalCount, 7),
  ]
}

export default computeAchievements
