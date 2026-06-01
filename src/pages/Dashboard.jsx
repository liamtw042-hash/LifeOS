import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'

const SECTIONS = [
  { path: '/goals', label: 'Goals', icon: '🎯', color: '#7C3AED' },
  { path: '/habits', label: 'Habits', icon: '✅', color: '#06B6D4' },
  { path: '/money', label: 'Money', icon: '💰', color: '#10B981' },
  { path: '/fitness', label: 'Fitness', icon: '💪', color: '#F97316' },
  { path: '/projects', label: 'Projects', icon: '📋', color: '#EC4899' },
  { path: '/journal', label: 'Journal', icon: '📓', color: '#EAB308' },
  { path: '/school', label: 'School', icon: '🎓', color: '#3B82F6' },
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

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { docs: habits, fetchDocs: fetchHabits } = useFirestore('habits')
  const { docs: goals, fetchDocs: fetchGoals } = useFirestore('goals')
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    fetchHabits()
    fetchGoals()
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [fetchHabits, fetchGoals])

  const today = new Date().toISOString().slice(0, 10)
  const habitsToday = habits.filter(h => (h.completions || []).includes(today))
  const activeGoals = goals.filter(g => (g.progress || 0) < 100)

  // Calculate streak: count consecutive days with at least 1 habit completion
  function calcStreak() {
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

  const streak = calcStreak()
  const name = user?.displayName?.split(' ')[0] || 'there'

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
