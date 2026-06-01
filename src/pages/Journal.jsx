import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#EAB308'

const MOODS = [
  { emoji: '😞', label: 'Rough', value: 1 },
  { emoji: '😐', label: 'Meh', value: 2 },
  { emoji: '🙂', label: 'OK', value: 3 },
  { emoji: '😊', label: 'Good', value: 4 },
  { emoji: '🤩', label: 'Great', value: 5 },
]

export default function Journal() {
  const { docs, loading, fetchDocs, addDocument, deleteDocument } = useFirestore('journal')
  const [showModal, setShowModal] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ mood: 3, text: '', date: new Date().toISOString().slice(0, 10) })

  useEffect(() => { fetchDocs() }, [])

  async function saveEntry(e) {
    e.preventDefault()
    if (!form.text.trim()) return
    await addDocument({ mood: form.mood, text: form.text, date: form.date })
    setShowModal(false)
    setForm({ mood: 3, text: '', date: new Date().toISOString().slice(0, 10) })
  }

  const sorted = [...docs].sort((a, b) => b.date?.localeCompare(a.date))

  function moodEmoji(val) {
    return MOODS.find((m) => m.value === val)?.emoji || '🙂'
  }

  function moodLabel(val) {
    return MOODS.find((m) => m.value === val)?.label || 'OK'
  }

  const avgMood = docs.length
    ? (docs.reduce((s, d) => s + (d.mood || 3), 0) / docs.length).toFixed(1)
    : null

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Journal</h1>
          <p className="text-sm text-white/40 mt-0.5">{docs.length} entries</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}40`, color: '#000' }}
        >
          + Write
        </button>
      </div>

      {avgMood && (
        <Card color={COLOR}>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: `${COLOR}20` }}
            >
              {moodEmoji(Math.round(parseFloat(avgMood)))}
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest">Average Mood</p>
              <p className="text-2xl font-black text-white mt-0.5">{avgMood} / 5</p>
              <p className="text-xs mt-0.5" style={{ color: COLOR }}>{moodLabel(Math.round(parseFloat(avgMood)))}</p>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner color={COLOR} />
      ) : sorted.length === 0 ? (
        <Card color={COLOR}>
          <div className="text-center py-8 text-white/30">
            <div className="text-4xl mb-3">📓</div>
            <p className="text-sm">No entries yet. Start writing!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry) => (
            <Card key={entry.id} color={COLOR}>
              <div
                className="cursor-pointer"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{moodEmoji(entry.mood)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: COLOR }}>
                        {moodLabel(entry.mood)}
                      </span>
                      <span className="text-xs text-white/30">{entry.date}</span>
                    </div>
                  </div>
                </div>
                <p className={`text-sm text-white/70 leading-relaxed ${expanded === entry.id ? '' : 'line-clamp-2'}`}>
                  {entry.text}
                </p>
              </div>
              {expanded === entry.id && (
                <button
                  onClick={() => deleteDocument(entry.id)}
                  className="mt-3 text-xs text-white/20 hover:text-red-400 transition-colors"
                >
                  Delete entry
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Entry" color={COLOR}>
        <form onSubmit={saveEntry} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">How are you feeling?</label>
            <div className="flex justify-between mt-3">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mood: m.value }))}
                  className="flex flex-col items-center gap-1 transition-all"
                >
                  <span
                    className={`text-3xl transition-all ${form.mood === m.value ? 'scale-125' : 'opacity-40 scale-100'}`}
                  >
                    {m.emoji}
                  </span>
                  <span
                    className="text-xs font-semibold transition-all"
                    style={{ color: form.mood === m.value ? COLOR : 'rgba(255,255,255,0.3)' }}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Write it out...</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="What's on your mind today?"
              rows={6}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-yellow-500 resize-none leading-relaxed"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold transition-all active:scale-95"
            style={{ background: COLOR, color: '#000' }}
          >
            Save Entry
          </button>
        </form>
      </Modal>
    </div>
  )
}
