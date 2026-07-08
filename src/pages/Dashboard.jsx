import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import { SPLIT, DAY_ORDER } from '../data/trainingProgram'
import { todayDayKey } from '../lib/training'

const SECTIONS = [
  { path: '/goals', label: 'Goals', icon: '🎯', color: '#7C3AED' },
  { path: '/habits', label: 'Habits', icon: '✅', color: '#06B6D4' },
  { path: '/money', label: 'Money', icon: '💰', color: '#10B981' },
  { path: '/fitness', label: 'Fitness', icon: '💪', color: '#F97316' },
  { path: '/projects', label: 'Projects', icon: '📋', color: '#EC4899' },
  { path: '/journal', label: 'Journal', icon: '📓', color: '#EAB308' },
  { path: '/school', label: 'School', icon: '🎓', color: '#3B82F6' },
]

const FITNESS = '#7C3AED'
const CYAN = '#06B6D4'

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

const todayStr = () => new Date().toISOString().slice(0, 10)
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function calcStreak(completions) {
  if (!completions || !completions.length) return 0
  let streak = 0
  const d = new Date()
  while (true) {
    const key = d.toISOString().slice(0, 10)
    if (!completions.includes(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const {
    docs: habits, fetchDocs: fetchHabits, addDocument: addHabit, updateDocument: updateHabit,
  } = useFirestore('habits')
  const { docs: goals, fetchDocs: fetchGoals } = useFirestore('goals')
  const {
    docs: dailyGoals, fetchDocs: fetchDaily, addDocument: addDaily, updateDocument: updateDaily,
  } = useFirestore('dailyGoals')
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    fetchHabits()
    fetchGoals()
    fetchDaily()
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [fetchHabits, fetchGoals, fetchDaily])

  const today = todayStr()
  const tomorrow = shiftDate(today, 1)
  const habitsToday = habits.filter(h => (h.completions || []).includes(today))
  const activeGoals = goals.filter(g => (g.progress || 0) < 100)

  function calcOverallStreak() {
    if (!habits.length) return 0
    let streak = 0
    const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0, 10)
      const anyDone = habits.some(h => (h.completions || []).includes(key))
      if (!anyDone) break
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  }

  const streak = calcOverallStreak()
  const name = user?.displayName?.split(' ')[0] || 'there'

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

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-white/40 text-sm font-medium">{formatDate()}</p>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-white mt-1">
            {getGreeting()},<br />{name} 👋
          </h1>
        </div>
        <button
          onClick={logout}
          className="btn-press mt-1 text-white/30 hover:text-white/60 transition-colors text-sm font-medium"
        >
          Sign out
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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
      <Card className="mb-6 py-5 text-center" accentColor="#7C3AED">
        <div className="text-4xl font-black tracking-tight text-white">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-white/30 text-xs font-semibold mt-1 uppercase tracking-widest">
          {time.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
      </Card>

      {/* ---- Today strip: training / rest + week strip ---- */}
      <Card accentColor={FITNESS} className="mb-6 p-4">
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

      {/* ---- Today's goals + set tomorrow's ---- */}
      <Card accentColor="#EAB308" className="mb-6 p-4">
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Today's 3 Goals</div>
        {todayGoals.length === 0 ? (
          <p className="text-sm text-white/35 mb-4">
            No goals set for today. Set 3 each night for the day ahead 👇
          </p>
        ) : (
          <div className="space-y-2 mb-4">
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

        <div className="pt-3 border-t border-white/10">
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
        </div>
      </Card>

      {/* ---- Today's habits ---- */}
      <Card accentColor={CYAN} className="mb-6 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Today's Habits</div>
          <button onClick={() => navigate('/habits')} className="btn-press text-[11px] font-bold" style={{ color: CYAN }}>
            Manage →
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
              return (
                <div key={habit.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
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
                  <span className={`flex-1 text-sm font-bold ${done ? 'text-white/40 line-through' : 'text-white'}`}>
                    {habit.name}
                  </span>
                  <span className="text-sm font-black text-white flex-shrink-0">{hStreak > 0 ? `${hStreak}🔥` : '–'}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Quick Access */}
      <div className="mb-4">
        <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 gap-3">
          {SECTIONS.map((s) => (
            <button
              key={s.path}
              onClick={() => navigate(s.path)}
              className="btn-press glass-card flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 text-left"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = s.color + '50'
                e.currentTarget.style.boxShadow = `0 0 20px ${s.color}22`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="font-bold text-white text-sm">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
