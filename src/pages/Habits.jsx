import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#06B6D4'

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
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

export default function Habits() {
  const { docs: habits, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('habits')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ emoji: '✅', name: '' })
  const today = new Date().toISOString().slice(0, 10)
  const days = getLast7Days()

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleAdd(e) {
    e.preventDefault()
    await addDocument({ ...form, completions: [] })
    setForm({ emoji: '✅', name: '' })
    setShowModal(false)
  }

  async function toggleToday(habit) {
    const completions = [...(habit.completions || [])]
    const idx = completions.indexOf(today)
    if (idx >= 0) completions.splice(idx, 1)
    else completions.push(today)
    await updateDocument(habit.id, { completions })
  }

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Habits</h1>
          <p className="text-white/40 text-sm mt-1">
            {habits.filter(h => (h.completions || []).includes(today)).length}/{habits.length} done today
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}
        >+</button>
      </div>

      {loading && <div className="flex justify-center py-12"><LoadingSpinner color={COLOR} size={32} /></div>}

      <div className="space-y-3">
        {habits.map((habit) => {
          const completions = habit.completions || []
          const doneToday = completions.includes(today)
          const streak = calcStreak(completions)
          return (
            <Card key={habit.id} accentColor={COLOR} className="p-4">
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleToday(habit)}
                  className="btn-press w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    background: doneToday ? COLOR : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${doneToday ? COLOR : 'rgba(255,255,255,0.15)'}`,
                    boxShadow: doneToday ? `0 0 16px ${COLOR}60` : 'none',
                  }}
                >
                  {doneToday && <span className="text-white text-base animate-checkmark">✓</span>}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{habit.emoji || '✅'}</span>
                    <span className={`font-bold text-sm ${doneToday ? 'text-white/50 line-through' : 'text-white'}`}>
                      {habit.name}
                    </span>
                  </div>
                  {/* 7-day grid */}
                  <div className="flex gap-1 mt-2">
                    {days.map((day, i) => {
                      const done = completions.includes(day)
                      const isToday = day === today
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-5 h-5 rounded-full transition-all"
                            style={{
                              background: done ? COLOR : 'rgba(255,255,255,0.08)',
                              border: isToday ? `1px solid ${COLOR}80` : '1px solid transparent',
                              boxShadow: done ? `0 0 6px ${COLOR}60` : 'none',
                            }}
                          />
                          <span className="text-[8px] text-white/20">
                            {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Streak */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-base font-black text-white">{streak > 0 ? `${streak}🔥` : '–'}</div>
                  <div className="text-[9px] text-white/30 uppercase tracking-wider">streak</div>
                </div>

                <button onClick={() => deleteDocument(habit.id)} className="text-white/15 hover:text-red-400 transition-colors ml-1">✕</button>
              </div>
            </Card>
          )
        })}
        {!loading && habits.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-semibold">Build your first habit</p>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Habit" accentColor={COLOR}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Emoji</label>
              <input type="text" value={form.emoji} onChange={e => setForm(f => ({...f, emoji: e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg" maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Habit Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#06B6D4] transition-colors"
                placeholder="e.g. Morning workout" />
            </div>
          </div>
          <button type="submit"
            className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #0891B2)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Add Habit
          </button>
        </form>
      </Modal>
    </div>
  )
}
