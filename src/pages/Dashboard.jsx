import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { SPLIT, DAY_ORDER } from '../data/trainingProgram'
import { todayDayKey } from '../lib/training'
import { computeAchievements } from '../lib/achievements'
import GlobalSearch from '../components/GlobalSearch'

const FITNESS = '#7C3AED'
const CYAN = '#06B6D4'
const GOAL_COLOR = '#7C3AED'

const SPLIT_ICON = { Push: '🔺', Pull: '🔻', Legs: '🦵', Upper: '💪', Arms: '💪', Rest: '😴' }

const STARTER_HABITS = [
  { emoji: '💊', name: 'Creatine' },
  { emoji: '😴', name: '8h+ sleep' },
  { emoji: '🚶', name: 'Walk / steps' },
  { emoji: '🧘', name: 'Stretch' },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localKey(d)
}

// Monday-based start of the week containing `d`.
function startOfWeek(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // 0 = Mon
  x.setDate(x.getDate() - dow)
  return x
}
// Completions falling inside the current (Mon–Sun) week.
function weekCompletions(completions) {
  const start = startOfWeek(new Date())
  const set = new Set(completions || [])
  let c = 0
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start)
    dd.setDate(dd.getDate() + i)
    if (set.has(localKey(dd))) c++
  }
  return c
}
// Grid of the last 4 weeks (Mon-first), each row a week, for a streak calendar.
function last4Weeks(completions) {
  const set = new Set(completions || [])
  const todayK = localKey(new Date())
  const start = startOfWeek(new Date())
  start.setDate(start.getDate() - 21) // 4 weeks incl. current
  const weeks = []
  for (let w = 0; w < 4; w++) {
    const row = []
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start)
      dd.setDate(dd.getDate() + w * 7 + i)
      const key = localKey(dd)
      row.push({ key, day: dd.getDate(), done: set.has(key), isToday: key === todayK, future: key > todayK })
    }
    weeks.push(row)
  }
  return weeks
}

function calcStreak(completions) {
  if (!completions || !completions.length) return 0
  let streak = 0
  const d = new Date()
  while (true) {
    const key = localKey(d)
    if (!completions.includes(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function CollapsibleSection({ storageKey, defaultOpen = false, accentColor, icon, title, summary, children }) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey)
      return v === null ? defaultOpen : v === '1'
    } catch {
      return defaultOpen
    }
  })
  useEffect(() => {
    try { localStorage.setItem(storageKey, open ? '1' : '0') } catch {}
  }, [storageKey, open])

  return (
    <Card accentColor={accentColor} className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-press w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-lg flex-shrink-0">{icon}</span>
        <span className="flex-1 font-bold text-white text-[15px] truncate">{title}</span>
        {summary != null && summary !== '' && (
          <span className="text-xs font-semibold text-white/40 flex-shrink-0">{summary}</span>
        )}
        <span
          className="text-white/40 text-xs flex-shrink-0 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-0.5">{children}</div>
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const {
    docs: habits, fetchDocs: fetchHabits, addDocument: addHabit,
    updateDocument: updateHabit, deleteDocument: deleteHabit,
  } = useFirestore('habits')
  const {
    docs: goals, fetchDocs: fetchGoals, addDocument: addGoal,
    updateDocument: updateGoal, deleteDocument: deleteGoal,
  } = useFirestore('goals')
  const {
    docs: dailyGoals, fetchDocs: fetchDaily, addDocument: addDaily, updateDocument: updateDaily,
  } = useFirestore('dailyGoals')
  const { docs: sessions, fetchDocs: fetchSessions } = useFirestore('workoutSessions')
  const { docs: weights, fetchDocs: fetchWeights } = useFirestore('weights')
  const { docs: journal, fetchDocs: fetchJournal } = useFirestore('journal')
  const { docs: foodLog, fetchDocs: fetchFood } = useFirestore('foodLog')
  const { docs: settingsDocs, fetchDocs: fetchSettings } = useFirestore('settings')
  const [time, setTime] = useState(new Date())
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    fetchHabits()
    fetchGoals()
    fetchDaily()
    fetchSessions()
    fetchWeights()
    fetchJournal()
    fetchFood()
    fetchSettings()
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [fetchHabits, fetchGoals, fetchDaily, fetchSessions, fetchWeights, fetchJournal, fetchFood, fetchSettings])

  const today = todayStr()
  const tomorrow = shiftDate(today, 1)
  const habitsToday = habits.filter(h => (h.completions || []).includes(today))
  const activeGoals = goals.filter(g => (g.progress || 0) < 100)

  function calcOverallStreak() {
    if (!habits.length) return 0
    let streak = 0
    const d = new Date()
    while (true) {
      const key = localKey(d)
      const anyDone = habits.some(h => (h.completions || []).includes(key))
      if (!anyDone) break
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  }

  const streak = calcOverallStreak()
  const settingsDoc = (settingsDocs || [])[0] || null
  const settingsName = String(settingsDoc?.displayName || '').trim()
  const name = (settingsName || user?.displayName || '').split(' ')[0] || 'there'

  // ---- Achievements ----
  const achievements = useMemo(
    () => computeAchievements({ sessions, habits, foodLog, weights, journal, today }),
    [sessions, habits, foodLog, weights, journal, today]
  )
  const earnedCount = achievements.filter((a) => a.earned).length

  // ---- Today's training split ----
  const todayKey = todayDayKey()
  const todaySplit = SPLIT[todayKey] || 'Rest'
  const isRest = todaySplit === 'Rest'

  // ---- Daily goals (tomorrow → today) ----
  const todayGoalDoc = useMemo(
    () => (dailyGoals || []).find((d) => d.date === today) || null,
    [dailyGoals, today]
  )
  const tomorrowGoalDoc = useMemo(
    () => (dailyGoals || []).find((d) => d.date === tomorrow) || null,
    [dailyGoals, tomorrow]
  )
  const todayGoals = todayGoalDoc?.goals || []

  const [tmrForm, setTmrForm] = useState(['', '', ''])
  const [savedTmr, setSavedTmr] = useState(false)
  useEffect(() => {
    const g = tomorrowGoalDoc?.goals || []
    setTmrForm([g[0]?.text || '', g[1]?.text || '', g[2]?.text || ''])
  }, [tomorrowGoalDoc])

  async function upsertDaily(dateStr, goalsArr) {
    const existing = (dailyGoals || []).find((d) => d.date === dateStr)
    if (existing) await updateDaily(existing.id, { goals: goalsArr })
    else await addDaily({ date: dateStr, goals: goalsArr })
  }

  async function toggleTodayGoal(idx) {
    if (!todayGoalDoc) return
    const next = (todayGoalDoc.goals || []).map((g, i) => (i === idx ? { ...g, done: !g.done } : g))
    await updateDaily(todayGoalDoc.id, { goals: next })
  }

  async function saveTomorrowGoals() {
    const goalsArr = tmrForm
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((text) => {
        const prev = (tomorrowGoalDoc?.goals || []).find((g) => g.text === text)
        return { text, done: prev?.done || false }
      })
    await upsertDaily(tomorrow, goalsArr)
    setSavedTmr(true)
    setTimeout(() => setSavedTmr(false), 1800)
  }

  // ---- Habits ----
  async function toggleHabit(habit) {
    const completions = [...(habit.completions || [])]
    const idx = completions.indexOf(today)
    if (idx >= 0) completions.splice(idx, 1)
    else completions.push(today)
    await updateHabit(habit.id, { completions })
  }

  async function seedStarterHabits() {
    for (const h of STARTER_HABITS) {
      await addHabit({ ...h, completions: [] })
    }
  }

  const [habitModal, setHabitModal] = useState(false)
  const [habitForm, setHabitForm] = useState({ emoji: '✅', name: '', weeklyTarget: '' })
  const [habitDetail, setHabitDetail] = useState(null) // habit for calendar modal
  async function submitHabit(e) {
    e.preventDefault()
    if (!habitForm.name.trim()) return
    const wt = parseInt(habitForm.weeklyTarget, 10)
    await addHabit({
      emoji: habitForm.emoji,
      name: habitForm.name.trim(),
      completions: [],
      weeklyTarget: Number.isFinite(wt) && wt > 0 ? Math.min(7, wt) : null,
    })
    setHabitForm({ emoji: '✅', name: '', weeklyTarget: '' })
    setHabitModal(false)
  }

  // ---- Long-term goals ----
  const [goalModal, setGoalModal] = useState(false)
  const [goalForm, setGoalForm] = useState({ emoji: '🎯', title: '', description: '', targetDate: '', progress: 0, milestones: [] })
  const [newMilestone, setNewMilestone] = useState('')

  async function submitGoal(e) {
    e.preventDefault()
    if (!goalForm.title.trim()) return
    await addGoal({ ...goalForm, title: goalForm.title.trim() })
    setGoalForm({ emoji: '🎯', title: '', description: '', targetDate: '', progress: 0, milestones: [] })
    setNewMilestone('')
    setGoalModal(false)
  }
  function addMilestoneToForm() {
    if (!newMilestone.trim()) return
    setGoalForm(f => ({ ...f, milestones: [...f.milestones, { text: newMilestone.trim(), done: false }] }))
    setNewMilestone('')
  }
  async function updateGoalProgress(id, progress) {
    await updateGoal(id, { progress })
  }
  async function toggleMilestone(goal, idx) {
    const milestones = [...(goal.milestones || [])]
    milestones[idx] = { ...milestones[idx], done: !milestones[idx].done }
    await updateGoal(goal.id, { milestones })
  }

  return (
    <div className="page-enter min-h-screen p-4 pt-10 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-sm font-medium">{formatDate()}</p>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-white mt-1">
            {getGreeting()},<br />{name} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 bg-white/5 border border-white/10 transition-colors"
            aria-label="Search"
          >
            🔍
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 bg-white/5 border border-white/10 transition-colors"
            aria-label="Settings"
          >
            ⚙️
          </button>
          <button
            onClick={logout}
            className="btn-press text-white/30 hover:text-white/60 transition-colors text-sm font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-4" accentColor="#06B6D4" hover>
          <div className="text-2xl font-black text-white">{habitsToday.length}/{habits.length}</div>
          <div className="text-xs text-white/40 font-semibold mt-0.5 uppercase tracking-wider">Habits</div>
        </Card>
        <Card className="text-center py-4" accentColor="#7C3AED" hover>
          <div className="text-2xl font-black text-white">{activeGoals.length}</div>
          <div className="text-xs text-white/40 font-semibold mt-0.5 uppercase tracking-wider">Goals</div>
        </Card>
        <Card className="text-center py-4" accentColor="#F97316" hover>
          <div className="text-2xl font-black text-white">{streak > 0 ? `${streak}🔥` : '0'}</div>
          <div className="text-xs text-white/40 font-semibold mt-0.5 uppercase tracking-wider">Streak</div>
        </Card>
      </div>

      {/* Time display */}
      <Card className="py-5 text-center" accentColor="#7C3AED">
        <div className="text-4xl font-black tracking-tight text-white">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-white/30 text-xs font-semibold mt-1 uppercase tracking-widest">
          {time.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
      </Card>

      {/* ---- Weekly Review entry ---- */}
      <Card accentColor="#7C3AED" className="p-0 overflow-hidden" hover>
        <button
          onClick={() => navigate('/review')}
          className="btn-press w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="text-lg flex-shrink-0">📊</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-[15px]">Weekly Review</div>
            <div className="text-[11px] text-white/40">Your last 7 days across fitness, habits & mood</div>
          </div>
          <span className="text-white/40 text-sm flex-shrink-0">→</span>
        </button>
      </Card>

      {/* ---- Wellness entry ---- */}
      <Card accentColor="#7C3AED" className="p-0 overflow-hidden" hover>
        <button
          onClick={() => navigate('/wellness')}
          className="btn-press w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="text-lg flex-shrink-0">🌙</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-[15px]">Wellness</div>
            <div className="text-[11px] text-white/40">Sleep, activity, supplements & fasting</div>
          </div>
          <span className="text-white/40 text-sm flex-shrink-0">→</span>
        </button>
      </Card>

      {/* ---- Today strip: training / rest + week strip ---- */}
      <Card accentColor={FITNESS} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Today</div>
            <div className="text-lg font-black text-white mt-0.5">
              {isRest ? 'Rest day' : 'Training day'} <span className="text-lg">{SPLIT_ICON[todaySplit] || '💪'}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/fitness')}
            className="btn-press text-[11px] font-bold px-3 py-1.5 rounded-full"
            style={{ color: FITNESS, border: `1px solid ${FITNESS}40`, background: isRest ? 'transparent' : `${FITNESS}18` }}
          >
            {isRest ? 'Recover' : `${todaySplit} →`}
          </button>
        </div>
        <div className="flex gap-1.5">
          {DAY_ORDER.map((dk) => {
            const label = SPLIT[dk] || 'Rest'
            const isToday = dk === todayKey
            const rest = label === 'Rest'
            return (
              <div key={dk} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-lg py-1.5 text-center transition-all"
                  style={{
                    background: isToday ? FITNESS : rest ? 'rgba(255,255,255,0.05)' : `${FITNESS}22`,
                    border: isToday ? `1px solid ${FITNESS}` : '1px solid transparent',
                    boxShadow: isToday ? `0 0 12px ${FITNESS}70` : 'none',
                  }}
                >
                  <div className="text-[9px] font-black" style={{ color: isToday ? '#fff' : rest ? 'rgba(255,255,255,0.3)' : FITNESS }}>
                    {dk}
                  </div>
                </div>
                <span className="text-[8px] text-white/40 whitespace-nowrap">{rest ? '—' : label}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ---- Today's 3 Goals ---- */}
      <CollapsibleSection
        storageKey="dash.section.todayGoals"
        defaultOpen
        accentColor="#EAB308"
        icon="🎯"
        title="Today's Goals"
        summary={todayGoals.length ? `${todayGoals.filter((g) => g.done).length}/${todayGoals.length} done` : 'None set'}
      >
        {todayGoals.length === 0 ? (
          <p className="text-sm text-white/35">
            No goals set for today. Plan tomorrow's below 👇
          </p>
        ) : (
          <div className="space-y-2">
            {todayGoals.map((g, i) => (
              <button
                key={i}
                onClick={() => toggleTodayGoal(i)}
                className="btn-press w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-left"
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: g.done ? '#EAB308' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${g.done ? '#EAB308' : 'rgba(255,255,255,0.15)'}`,
                  }}
                >
                  {g.done && <span className="text-black text-xs font-black animate-checkmark">✓</span>}
                </span>
                <span className={`text-sm font-semibold ${g.done ? 'text-white/40 line-through' : 'text-white'}`}>
                  {g.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ---- Long-term goals ---- */}
      <CollapsibleSection
        storageKey="dash.section.goals"
        defaultOpen
        accentColor={GOAL_COLOR}
        icon="🏆"
        title="Goals"
        summary={goals.length ? `${activeGoals.length} active` : 'None'}
      >
        <div className="flex justify-end mb-3">
          <button onClick={() => setGoalModal(true)} className="btn-press text-[11px] font-bold" style={{ color: GOAL_COLOR }}>
            + Add
          </button>
        </div>
        {goals.length === 0 ? (
          <p className="text-sm text-white/35 py-1">No goals yet. Add a long-term goal to track progress and milestones.</p>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <div key={goal.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{goal.emoji || '🎯'}</span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">{goal.title}</h3>
                      {goal.targetDate && (
                        <p className="text-white/30 text-[11px] mt-0.5">
                          🎯 {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(goal.progress || 0) >= 100 && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">Done!</span>}
                    <button onClick={() => deleteGoal(goal.id)} className="text-white/20 hover:text-red-400 transition-colors text-sm">✕</button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Progress</span>
                    <span className="text-[11px] font-bold" style={{ color: GOAL_COLOR }}>{goal.progress || 0}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100"
                    value={goal.progress || 0}
                    onChange={(e) => updateGoalProgress(goal.id, parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: GOAL_COLOR, background: `linear-gradient(to right, ${GOAL_COLOR} ${goal.progress || 0}%, rgba(255,255,255,0.1) ${goal.progress || 0}%)` }}
                  />
                </div>

                {(goal.milestones || []).length > 0 && (
                  <div className="space-y-1.5">
                    {goal.milestones.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => toggleMilestone(goal, i)}
                        className="btn-press flex items-center gap-2 w-full text-left"
                      >
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ background: m.done ? GOAL_COLOR : 'rgba(255,255,255,0.1)', border: `1px solid ${m.done ? GOAL_COLOR : 'rgba(255,255,255,0.2)'}` }}>
                          {m.done && <span className="text-white text-[10px] animate-checkmark">✓</span>}
                        </div>
                        <span className={`text-xs ${m.done ? 'line-through text-white/30' : 'text-white/70'}`}>{m.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ---- Today's habits ---- */}
      <CollapsibleSection
        storageKey="dash.section.habits"
        defaultOpen
        accentColor={CYAN}
        icon="✅"
        title="Habits"
        summary={habits.length ? `${habitsToday.length}/${habits.length} today` : 'None'}
      >
        <div className="flex justify-end mb-3">
          <button onClick={() => setHabitModal(true)} className="btn-press text-[11px] font-bold" style={{ color: CYAN }}>
            + Add
          </button>
        </div>
        {habits.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-white/35 mb-3">No habits yet. Seed a starter set for fitness.</p>
            <button
              onClick={seedStarterHabits}
              className="btn-press w-full py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${CYAN}, #0891B2)`, boxShadow: `0 0 20px ${CYAN}40` }}
            >
              ➕ Add starter habits
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => {
              const completions = habit.completions || []
              const done = completions.includes(today)
              const hStreak = calcStreak(completions)
              const target = Number(habit.weeklyTarget) || 0
              const weekDone = weekCompletions(completions)
              const metTarget = target > 0 && weekDone >= target
              return (
                <div key={habit.id} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleHabit(habit)}
                      className="btn-press w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: done ? CYAN : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${done ? CYAN : 'rgba(255,255,255,0.15)'}`,
                        boxShadow: done ? `0 0 12px ${CYAN}60` : 'none',
                      }}
                    >
                      {done && <span className="text-white text-sm animate-checkmark">✓</span>}
                    </button>
                    <span className="text-base">{habit.emoji || '✅'}</span>
                    <button
                      onClick={() => setHabitDetail(habit)}
                      className="btn-press flex-1 text-left min-w-0"
                      aria-label={`${habit.name} history`}
                    >
                      <span className={`block text-sm font-bold truncate ${done ? 'text-white/40 line-through' : 'text-white'}`}>
                        {habit.name}
                      </span>
                      {target > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color: metTarget ? '#10B981' : 'rgba(255,255,255,0.4)' }}>
                          {weekDone}/{target} this week{metTarget ? ' ✓' : ''}
                        </span>
                      )}
                    </button>
                    <span className="text-sm font-black text-white flex-shrink-0">{hStreak > 0 ? `${hStreak}🔥` : '–'}</span>
                    <button onClick={() => deleteHabit(habit.id)} className="text-white/15 hover:text-red-400 transition-colors text-sm flex-shrink-0">✕</button>
                  </div>
                  {target > 0 && (
                    <div className="mt-2 ml-11 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (weekDone / target) * 100)}%`, background: metTarget ? '#10B981' : CYAN }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* ---- Plan tomorrow ---- */}
      <CollapsibleSection
        storageKey="dash.section.planTomorrow"
        defaultOpen
        accentColor="#EAB308"
        icon="🌙"
        title="Plan Tomorrow"
        summary={(tomorrowGoalDoc?.goals || []).length ? `${(tomorrowGoalDoc?.goals || []).length} set` : 'Not set'}
      >
        <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Set tomorrow's 3 goals</div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              value={tmrForm[i]}
              onChange={(e) => setTmrForm((f) => f.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={`Goal ${i + 1}`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:border-[#EAB308] transition-colors"
            />
          ))}
        </div>
        <button
          onClick={saveTomorrowGoals}
          className="btn-press w-full mt-2 py-2.5 rounded-xl font-bold text-black text-sm"
          style={{ background: 'linear-gradient(135deg, #EAB308, #CA8A04)', boxShadow: '0 0 20px #EAB30840' }}
        >
          {savedTmr ? 'Saved ✓' : "Save tomorrow's goals"}
        </button>
      </CollapsibleSection>

      {/* ---- Achievements ---- */}
      <CollapsibleSection
        storageKey="dash.section.achievements"
        defaultOpen={false}
        accentColor={GOAL_COLOR}
        icon="🏅"
        title="Achievements"
        summary={`${earnedCount}/${achievements.length} earned`}
      >
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="p-3 rounded-2xl border flex flex-col items-center text-center transition-all"
              style={{
                background: a.earned ? `${GOAL_COLOR}18` : 'rgba(255,255,255,0.03)',
                borderColor: a.earned ? `${GOAL_COLOR}70` : 'rgba(255,255,255,0.08)',
                boxShadow: a.earned ? `0 0 16px ${GOAL_COLOR}45` : 'none',
                opacity: a.earned ? 1 : 0.55,
              }}
            >
              <div
                className="text-3xl mb-1.5"
                style={{ filter: a.earned ? `drop-shadow(0 0 8px ${GOAL_COLOR})` : 'grayscale(1)' }}
              >
                {a.icon}
              </div>
              <div className={`text-[13px] font-black leading-tight ${a.earned ? 'text-white' : 'text-white/60'}`}>
                {a.title}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{a.desc}</div>
              {a.earned ? (
                <div className="text-[10px] font-bold mt-1.5" style={{ color: GOAL_COLOR }}>✓ Earned</div>
              ) : (
                <div className="w-full mt-2">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((a.progress.current / a.progress.target) * 100)}%`,
                        background: GOAL_COLOR,
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-white/45 mt-1">
                    {a.progress.current}/{a.progress.target}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ---- Global search ---- */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ---- Add Habit modal ---- */}
      <Modal isOpen={habitModal} onClose={() => setHabitModal(false)} title="New Habit" accentColor={CYAN}>
        <form onSubmit={submitHabit} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Emoji</label>
              <input type="text" value={habitForm.emoji} onChange={e => setHabitForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg" maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Habit Name</label>
              <input type="text" value={habitForm.name} onChange={e => setHabitForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#06B6D4] transition-colors"
                placeholder="e.g. Morning workout" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Weekly target (optional)</label>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
                const active = String(habitForm.weeklyTarget || '') === String(n) || (n === 0 && !habitForm.weeklyTarget)
                return (
                  <button key={n} type="button"
                    onClick={() => setHabitForm(f => ({ ...f, weeklyTarget: n === 0 ? '' : String(n) }))}
                    className="btn-press flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? `${CYAN}25` : 'rgba(255,255,255,0.04)',
                      color: active ? CYAN : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${active ? CYAN + '60' : 'transparent'}`,
                    }}>
                    {n === 0 ? '—' : n}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-white/30 mt-1.5">Days per week you aim to complete this habit.</p>
          </div>
          <button type="submit"
            className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${CYAN}, #0891B2)`, boxShadow: `0 0 30px ${CYAN}50` }}>
            Add Habit
          </button>
        </form>
      </Modal>

      {/* ---- Habit streak calendar modal ---- */}
      <Modal isOpen={!!habitDetail} onClose={() => setHabitDetail(null)} title={habitDetail ? `${habitDetail.emoji || '✅'} ${habitDetail.name}` : 'Habit'} accentColor={CYAN}>
        {habitDetail && (() => {
          const completions = habitDetail.completions || []
          const weeks = last4Weeks(completions)
          const hStreak = calcStreak(completions)
          const target = Number(habitDetail.weeklyTarget) || 0
          const weekDone = weekCompletions(completions)
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="text-lg font-black text-white">{hStreak}🔥</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Streak</div>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="text-lg font-black text-white">{completions.length}</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Total</div>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="text-lg font-black text-white">{target > 0 ? `${weekDone}/${target}` : weekDone}</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">This week</div>
                </div>
              </div>
              <div>
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-[9px] font-bold text-white/30">{d}</div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {weeks.map((row, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1.5">
                      {row.map((c) => (
                        <div key={c.key}
                          className="aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all"
                          style={{
                            background: c.done ? CYAN : 'rgba(255,255,255,0.04)',
                            color: c.done ? '#fff' : c.future ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)',
                            border: c.isToday ? `1.5px solid ${c.done ? '#fff' : CYAN}` : '1px solid transparent',
                            opacity: c.future ? 0.4 : 1,
                            boxShadow: c.done ? `0 0 8px ${CYAN}60` : 'none',
                          }}>
                          {c.day}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/30 mt-2 text-center">Last 4 weeks · completed days highlighted</p>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ---- Add Goal modal ---- */}
      <Modal isOpen={goalModal} onClose={() => setGoalModal(false)} title="New Goal" accentColor={GOAL_COLOR}>
        <form onSubmit={submitGoal} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Emoji</label>
              <input type="text" value={goalForm.emoji} onChange={e => setGoalForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg" maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Title</label>
              <input type="text" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
                placeholder="Goal name" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Description</label>
            <textarea value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:border-[#7C3AED] transition-colors"
              placeholder="Why does this matter?" rows={2} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Target Date</label>
            <input type="date" value={goalForm.targetDate} onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Milestones</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMilestoneToForm())}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
                placeholder="Add a milestone..." />
              <button type="button" onClick={addMilestoneToForm}
                className="btn-press px-4 py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: GOAL_COLOR }}>+</button>
            </div>
            {goalForm.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-white/50 text-xs flex-1">{m.text}</span>
                <button type="button" onClick={() => setGoalForm(f => ({ ...f, milestones: f.milestones.filter((_, j) => j !== i) }))}
                  className="text-white/20 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
          <button type="submit"
            className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${GOAL_COLOR}, #4F46E5)`, boxShadow: `0 0 30px ${GOAL_COLOR}50` }}>
            Add Goal
          </button>
        </form>
      </Modal>
    </div>
  )
}
