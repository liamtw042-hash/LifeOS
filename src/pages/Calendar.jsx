import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#7C3AED'
const WORKOUT = '#7C3AED'
const JOURNAL = '#EAB308'
const WEIGH = '#06B6D4'
const MEASURE = '#EC4899'
const OVERDUE = '#EF4444'

const MOODS = {
  1: '😞', 2: '😐', 3: '🙂', 4: '😊', 5: '🤩',
}
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Calendar() {
  const navigate = useNavigate()
  const { docs: sessions, fetchDocs: fetchSessions } = useFirestore('workoutSessions')
  const { docs: assignments, fetchDocs: fetchAssignments } = useFirestore('assignments')
  const { docs: journal, fetchDocs: fetchJournal } = useFirestore('journal')
  const { docs: weights, fetchDocs: fetchWeights } = useFirestore('weights')
  const { docs: measurements, fetchDocs: fetchMeasurements } = useFirestore('measurements')

  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(null) // 'YYYY-MM-DD'

  useEffect(() => {
    fetchSessions(); fetchAssignments(); fetchJournal(); fetchWeights(); fetchMeasurements()
  }, [fetchSessions, fetchAssignments, fetchJournal, fetchWeights, fetchMeasurements])

  const todayKey = localKey(new Date())

  // Aggregate events by day key.
  const byDay = useMemo(() => {
    const map = {}
    const ensure = (k) => (map[k] = map[k] || { workouts: [], assignments: [], journal: [], weights: [], measurements: [] })
    for (const s of sessions || []) if (s && s.date) ensure(s.date).workouts.push(s)
    for (const a of assignments || []) if (a && a.dueDate) ensure(a.dueDate).assignments.push(a)
    for (const j of journal || []) if (j && j.date) ensure(j.date).journal.push(j)
    for (const w of weights || []) if (w && w.date) ensure(w.date).weights.push(w)
    for (const m of measurements || []) if (m && m.date) ensure(m.date).measurements.push(m)
    return map
  }, [sessions, assignments, journal, weights, measurements])

  // Build calendar grid (weeks of days, some null for padding).
  const grid = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startDow = first.getDay()
    const cells = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      cells.push({ day, key: localKey(d) })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  const anyLoading = false

  function dots(key) {
    const ev = byDay[key]
    if (!ev) return []
    const out = []
    if (ev.workouts.length) out.push(WORKOUT)
    for (const a of ev.assignments) out.push(!a.done && a.dueDate < todayKey ? OVERDUE : (a.color || '#3B82F6'))
    if (ev.journal.length) out.push(JOURNAL)
    if (ev.weights.length) out.push(WEIGH)
    if (ev.measurements.length) out.push(MEASURE)
    return out.slice(0, 5)
  }

  const monthEventCount = useMemo(() => {
    let n = 0
    for (const c of grid) if (c && byDay[c.key]) {
      const e = byDay[c.key]
      n += e.workouts.length + e.assignments.length + e.journal.length + e.weights.length + e.measurements.length
    }
    return n
  }, [grid, byDay])

  const sel = selected ? byDay[selected] : null

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="readout text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">// Timeline</div>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-glow" style={{ color: COLOR }}>Calendar</h1>
          <p className="text-white/40 text-sm mt-1"><span className="readout">{monthEventCount}</span> events this month</p>
        </div>
        <button
          onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayKey) }}
          className="btn-press px-4 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60`, color: '#fff' }}>
          Today
        </button>
      </div>

      <Card accentColor={COLOR} className="p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10">‹</button>
          <div className="text-center">
            <div className="font-black text-white text-lg tracking-tight">{MONTHS[cursor.getMonth()]}</div>
            <div className="readout text-xs text-white/30">{cursor.getFullYear()}</div>
          </div>
          <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="readout text-center text-[10px] font-bold text-white/30 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((c, i) => {
            if (!c) return <div key={i} />
            const isToday = c.key === todayKey
            const ds = dots(c.key)
            const isSel = c.key === selected
            return (
              <button key={i} onClick={() => setSelected(c.key)}
                className="btn-press aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 gap-1 transition-all"
                style={{
                  background: isToday ? `${COLOR}22` : isSel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isToday ? `1.5px solid ${COLOR}` : isSel ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--line)',
                  boxShadow: isToday ? `0 0 14px ${COLOR}55, inset 0 0 12px ${COLOR}22` : 'none',
                }}>
                <span
                  className={`readout text-xs font-bold ${isToday ? 'text-white' : 'text-white/60'}`}
                  style={{ textShadow: isToday ? `0 0 10px ${COLOR}` : 'none' }}
                >
                  {c.day}
                </span>
                <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                  {ds.map((color, j) => (
                    <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="hud-panel p-3 mb-2">
        <div className="readout text-[9px] font-bold uppercase tracking-[0.25em] text-white/35 mb-2">Legend</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/50">
          {[[WORKOUT, 'Workout'], [JOURNAL, 'Journal'], [WEIGH, 'Weigh-in'], [MEASURE, 'Measurement'], [OVERDUE, 'Overdue']].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)}
        title={selected ? new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
        accentColor={COLOR}>
        <div className="space-y-3">
          {!sel && <p className="text-sm text-white/35 py-4 text-center">Nothing logged this day.</p>}

          {sel && sel.workouts.map((w, i) => (
            <div key={`w${i}`} className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: WORKOUT, boxShadow: `0 0 6px ${WORKOUT}` }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Workout{w.day ? ` · ${w.day}` : ''}</div>
                <div className="text-[11px] text-white/35">Training session</div>
              </div>
            </div>
          ))}

          {sel && sel.assignments.map((a, i) => {
            const overdue = !a.done && a.dueDate < todayKey
            return (
              <button key={`a${i}`} onClick={() => navigate('/school')}
                className="btn-press w-full text-left p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: overdue ? OVERDUE : (a.color || '#3B82F6'), boxShadow: `0 0 6px ${overdue ? OVERDUE : (a.color || '#3B82F6')}` }} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${a.done ? 'text-white/40 line-through' : 'text-white'}`}>{a.title}</div>
                  <div className="text-[11px]" style={{ color: overdue ? OVERDUE : 'rgba(255,255,255,0.35)' }}>
                    {a.subject ? `${a.subject} · ` : ''}{a.done ? 'Done' : overdue ? 'Overdue' : 'Due'}
                  </div>
                </div>
                <span className="text-white/30 text-xs">→</span>
              </button>
            )
          })}

          {sel && sel.journal.map((j, i) => (
            <button key={`j${i}`} onClick={() => navigate('/journal')}
              className="btn-press w-full text-left p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              <span className="text-xl flex-shrink-0">{MOODS[j.mood] || '🙂'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Journal entry</div>
                <div className="text-[11px] text-white/35 truncate">{j.text}</div>
              </div>
              <span className="text-white/30 text-xs">→</span>
            </button>
          ))}

          {sel && sel.weights.map((w, i) => (
            <div key={`wt${i}`} className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: WEIGH, boxShadow: `0 0 6px ${WEIGH}` }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Weigh-in{Number.isFinite(Number(w.weight)) ? ` · ${Number(w.weight)}` : ''}</div>
                <div className="text-[11px] text-white/35">Body weight logged</div>
              </div>
            </div>
          ))}

          {sel && sel.measurements.map((m, i) => (
            <div key={`m${i}`} className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: MEASURE, boxShadow: `0 0 6px ${MEASURE}` }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Measurement</div>
                <div className="text-[11px] text-white/35">Body measurement logged</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
