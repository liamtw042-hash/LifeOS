import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import { LineChart, BarChart, Donut, Sparkline } from '../components/charts/Charts'
import { estimateVolume } from '../lib/training'

const COLOR = '#7C3AED'
const CYAN = '#22D3EE'
const DEFAULT_TARGETS = { calories: 2200, protein: 150, carbs: 220, fat: 70 }
const MOOD_EMOJI = { 1: '😞', 2: '😐', 3: '🙂', 4: '😊', 5: '🤩' }

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftKey(days) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return localKey(d)
}
// Array of last N local YYYY-MM-DD keys, oldest first.
function lastNDays(n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) out.push(shiftKey(-i))
  return out
}
const round = (x) => Math.round(Number(x) || 0)
const sumItems = (items, field) =>
  (items || []).reduce((a, it) => a + (Number(it[field]) || 0), 0)

function SectionTitle({ children }) {
  return <div className="readout text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">{children}</div>
}

function Stat({ label, value, sub, color = '#fff', spark, sparkColor }) {
  return (
    <div className="text-center glass-card py-3 px-2 rounded-xl">
      <div className="readout text-xl font-black" style={{ color, textShadow: color !== '#fff' ? `0 0 12px ${color}55` : 'none' }}>{value}</div>
      <div className="readout text-[9px] text-white/35 uppercase tracking-widest mt-0.5">{label}</div>
      {sub != null && <div className="readout text-[10px] text-white/40 mt-0.5">{sub}</div>}
      {Array.isArray(spark) && spark.length >= 2 && (
        <div className="spark-fill h-6 mt-1.5"><Sparkline data={spark} color={sparkColor || color} /></div>
      )}
    </div>
  )
}

function Empty({ text = 'No data yet' }) {
  return <div className="text-center py-5 text-sm text-white/30">{text}</div>
}

export default function Review() {
  const navigate = useNavigate()
  const { docs: foodLogs, loading: lFood, fetchDocs: fetchFood } = useFirestore('foodLog')
  const { docs: sessions, loading: lSess, fetchDocs: fetchSessions } = useFirestore('workoutSessions')
  const { docs: weights, loading: lWeight, fetchDocs: fetchWeights } = useFirestore('weights')
  const { docs: habits, loading: lHabits, fetchDocs: fetchHabits } = useFirestore('habits')
  const { docs: journal, loading: lJournal, fetchDocs: fetchJournal } = useFirestore('journal')
  const { docs: profiles, fetchDocs: fetchProfile } = useFirestore('fitnessProfile')

  useEffect(() => {
    fetchFood(); fetchSessions(); fetchWeights(); fetchHabits(); fetchJournal(); fetchProfile()
  }, [fetchFood, fetchSessions, fetchWeights, fetchHabits, fetchJournal, fetchProfile])

  const loading = lFood || lSess || lWeight || lHabits || lJournal

  const targets = useMemo(() => {
    const p = (profiles || [])[0]
    return p
      ? {
          calories: p.calories || DEFAULT_TARGETS.calories,
          protein: p.protein || DEFAULT_TARGETS.protein,
        }
      : DEFAULT_TARGETS
  }, [profiles])

  const week = useMemo(() => lastNDays(7), [])
  const weekSet = useMemo(() => new Set(week), [week])
  const prevWeek = useMemo(() => {
    const out = []
    for (let i = 13; i >= 7; i--) out.push(shiftKey(-i))
    return out
  }, [])

  // ---- Nutrition ----
  const nutrition = useMemo(() => {
    const byDate = {}
    for (const log of foodLogs || []) byDate[log.date] = log
    const calSeries = week.map((d) => ({
      label: d.slice(5).replace('-', '/'),
      value: byDate[d] ? round(sumItems(byDate[d].items, 'cal')) : 0,
    }))
    const proSeries = week.map((d) => ({
      label: d.slice(5).replace('-', '/'),
      value: byDate[d] ? round(sumItems(byDate[d].items, 'p')) : 0,
    }))
    const logged = week.filter((d) => byDate[d] && (byDate[d].items || []).length).length
    const avgCal = logged ? round(calSeries.reduce((a, s) => a + s.value, 0) / logged) : 0
    const avgPro = logged ? round(proSeries.reduce((a, s) => a + s.value, 0) / logged) : 0
    return { calSeries, proSeries, logged, avgCal, avgPro }
  }, [foodLogs, week])

  // ---- Training ----
  const training = useMemo(() => {
    const inWeek = (sessions || []).filter((s) => weekSet.has(s.date))
    let volume = 0
    let prs = 0
    const days = []
    for (const s of inWeek) {
      volume += Number(s.volume) || estimateVolume(s.exercises)
      prs += (s.prs || []).length
      days.push(s.date)
    }
    return { count: inWeek.length, volume: round(volume), prs, days: [...new Set(days)].sort() }
  }, [sessions, weekSet])

  // ---- Weight ----
  const weight = useMemo(() => {
    const sorted = [...(weights || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const inWeek = sorted.filter((w) => weekSet.has(w.date))
    const series = inWeek.map((w) => ({ label: (w.date || '').slice(5).replace('-', '/'), value: Number(w.value) || 0 }))
    const latest = sorted.length ? Number(sorted[sorted.length - 1].value) : null
    // nearest weigh-in to 7 days ago
    const target7 = shiftKey(-6)
    let start = null
    for (const w of sorted) { if (w.date <= target7) start = Number(w.value) }
    if (start == null && inWeek.length) start = Number(inWeek[0].value)
    const change = latest != null && start != null ? latest - start : null
    return { series, latest, change }
  }, [weights, weekSet])

  // ---- Habits ----
  const habitPct = useMemo(() => {
    const hs = habits || []
    if (!hs.length) return null
    let done = 0
    for (const h of hs) {
      const set = new Set(h.completions || [])
      for (const d of week) if (set.has(d)) done++
    }
    const possible = hs.length * 7
    return possible ? Math.round((done / possible) * 100) : 0
  }, [habits, week])

  // ---- Mood ----
  const mood = useMemo(() => {
    const inWeek = (journal || []).filter((j) => weekSet.has(j.date) && j.mood != null)
    if (!inWeek.length) return null
    const avg = inWeek.reduce((a, j) => a + (Number(j.mood) || 0), 0) / inWeek.length
    return { avg, count: inWeek.length, emoji: MOOD_EMOJI[Math.round(avg)] || '🙂' }
  }, [journal, weekSet])

  return (
    <div className="page-enter min-h-screen p-4 pt-10 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10"
          aria-label="Back to Dashboard"
        >
          ‹
        </button>
        <div>
          <p className="readout text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">// Last 7 days</p>
          <h1 className="text-2xl font-black tracking-[-0.02em] text-white text-glow">Weekly Review 📊</h1>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-6"><LoadingSpinner color={COLOR} size={28} /></div>
      )}

      {/* Nutrition */}
      <Card accentColor={COLOR} className="p-4">
        <SectionTitle>🍽 Nutrition</SectionTitle>
        {nutrition.logged === 0 ? (
          <Empty text="No food logged this week" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Stat label="Avg calories" value={nutrition.avgCal} sub={`target ${targets.calories}`} color={COLOR}
                spark={nutrition.calSeries.map((s) => s.value)} sparkColor={COLOR} />
              <Stat label="Avg protein" value={`${nutrition.avgPro}g`} sub={`target ${targets.protein}g`} color={COLOR}
                spark={nutrition.proSeries.map((s) => s.value)} sparkColor={CYAN} />
            </div>
            <div className="readout text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1">Calories / day · target {targets.calories}</div>
            <BarChart data={nutrition.calSeries} color={COLOR} target={targets.calories} height={130} />
            <div className="hairline my-3" />
            <div className="readout text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1">Protein / day · target {targets.protein}g</div>
            <LineChart data={nutrition.proSeries} color={CYAN} target={targets.protein} height={130} yLabel="g" />
          </>
        )}
      </Card>

      {/* Training */}
      <Card accentColor={COLOR} className="p-4">
        <SectionTitle>🏋️ Training</SectionTitle>
        {training.count === 0 ? (
          <Empty text="No workouts logged this week" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Workouts" value={training.count} color={COLOR} />
              <Stat label="Volume" value={`${training.volume}kg`} color={COLOR} />
              <Stat label="PRs" value={training.prs} color={COLOR} />
            </div>
            {training.days.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {training.days.map((d) => (
                  <span key={d} className="readout text-[11px] font-semibold text-white/70 px-2 py-1 rounded-md"
                    style={{ background: `${COLOR}14`, border: `1px solid ${COLOR}3a` }}>
                    {d.slice(5).replace('-', '/')}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Weight */}
      <Card accentColor={COLOR} className="p-4">
        <SectionTitle>⚖️ Weight</SectionTitle>
        {weight.series.length === 0 ? (
          <Empty text="No weigh-ins this week" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Stat label="Latest" value={weight.latest != null ? `${weight.latest}kg` : '–'} color={COLOR}
                spark={weight.series.map((s) => s.value)} sparkColor={COLOR} />
              <Stat
                label="7-day change"
                value={weight.change == null ? '–' : `${weight.change > 0 ? '+' : ''}${weight.change.toFixed(1)}kg`}
                color={weight.change == null ? '#fff' : weight.change <= 0 ? '#10B981' : '#F97316'}
              />
            </div>
            <LineChart data={weight.series} color={COLOR} height={120} yLabel="kg" />
          </>
        )}
      </Card>

      {/* Habits & Mood */}
      <div className="grid grid-cols-2 gap-3">
        <Card accentColor={COLOR} className="p-4 text-center">
          <SectionTitle>✅ Habits</SectionTitle>
          {habitPct == null ? (
            <Empty text="No habits" />
          ) : (
            <div className="flex justify-center">
              <Donut value={habitPct} max={100} label="completion" color={COLOR} size={112} />
            </div>
          )}
        </Card>
        <Card accentColor={COLOR} className="p-4 text-center">
          <SectionTitle>🧠 Mood</SectionTitle>
          {mood == null ? (
            <Empty text="No entries" />
          ) : (
            <>
              <div className="text-4xl" style={{ filter: `drop-shadow(0 0 10px ${CYAN}55)` }}>{mood.emoji}</div>
              <div className="readout text-lg font-black text-white mt-1">{mood.avg.toFixed(1)}<span className="text-xs text-white/40">/5</span></div>
              <div className="readout text-[10px] text-white/40 uppercase tracking-widest mt-0.5">{mood.count} entries</div>
            </>
          )}
        </Card>
      </div>

      <button
        onClick={() => navigate('/')}
        className="btn-press w-full py-3 rounded-xl text-sm font-bold text-white/70 bg-white/5 border border-white/10"
      >
        Back to Dashboard
      </button>
    </div>
  )
}
