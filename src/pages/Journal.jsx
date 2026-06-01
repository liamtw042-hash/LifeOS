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

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.text.trim()) return
    await addDocument({ mood: form.mood, text: form.text, date: form.date })
    setShowModal(false)
    setForm({ mood: 3, text: '', date: new Date().toISOString().slice(0, 10) })
  }

  const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const moodEmoji = (v) => MOODS.find(m => m.value === v)?.emoji || '🙂'
  const moodLabel = (v) => MOODS.find(m => m.value === v)?.label || 'OK'
  const avgMood = docs.length ? (docs.reduce((s, d) => s + (d.mood || 3), 0) / docs.length).toFixed(1) : null

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Journal</h1>
          <p className="text-white/40 text-sm mt-1">{docs.length} entries</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="btn-press px-4 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60`, color: '#000' }}>
          + Write
        </button>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner color={COLOR} size={32} /></div>}

      {avgMood && (
        <Card accentColor={COLOR} className="mb-5 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: `${COLOR}18` }}>
            {moodEmoji(Math.round(parseFloat(avgMood)))}
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase tracking-widest">Average Mood</div>
            <div className="text-2xl font-black text-white mt-0.5">{avgMood}<span className="text-white/30 text-base"> / 5</span></div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: COLOR }}>{moodLabel(Math.round(parseFloat(avgMood)))}</div>
          </div>
          <div className="ml-auto flex gap-0.5">
            {[1,2,3,4,5].map(v => (
              <div key={v} className="w-1.5 h-6 rounded-full"
                style={{ background: v <= Math.round(parseFloat(avgMood)) ? COLOR : `${COLOR}25` }} />
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {sorted.map(entry => (
          <Card key={entry.id} accentColor={COLOR}
            className="p-4 cursor-pointer"
            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 flex-shrink-0">{moodEmoji(entry.mood)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: COLOR }}>{moodLabel(entry.mood)}</span>
                  <span className="text-xs text-white/30">{entry.date}</span>
                </div>
                <p className={`text-sm text-white/70 leading-relaxed ${expanded === entry.id ? '' : 'line-clamp-2'}`}>
                  {entry.text}
                </p>
                {expanded !== entry.id && entry.text?.length > 90 && (
                  <span className="text-xs mt-1 block" style={{ color: COLOR }}>Read more...</span>
                )}
              </div>
            </div>
            {expanded === entry.id && (
              <div className="mt-3 pt-3 border-t border-white/08 flex justify-end">
                <button onClick={e => { e.stopPropagation(); deleteDocument(entry.id) }}
                  className="text-xs text-white/20 hover:text-red-400 transition-colors">
                  Delete entry
                </button>
              </div>
            )}
          </Card>
        ))}
        {!loading && docs.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-3">📓</div>
            <p className="font-semibold">Write your first entry</p>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Entry" accentColor={COLOR}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-3 uppercase tracking-widest">How are you feeling?</label>
            <div className="flex justify-between px-2">
              {MOODS.map(m => (
                <button key={m.value} type="button" onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                  className="flex flex-col items-center gap-1.5 transition-all btn-press">
                  <span className={`text-3xl transition-all duration-200 ${form.mood === m.value ? 'scale-125' : 'opacity-35 scale-100'}`}>
                    {m.emoji}
                  </span>
                  <span className="text-[10px] font-semibold transition-colors"
                    style={{ color: form.mood === m.value ? COLOR : 'rgba(255,255,255,0.25)' }}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#EAB308] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Write it out...</label>
            <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} required
              rows={5} placeholder="What's on your mind today?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#EAB308] transition-colors resize-none leading-relaxed" />
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #CA8A04)`, boxShadow: `0 0 30px ${COLOR}50`, color: '#000' }}>
            Save Entry
          </button>
        </form>
      </Modal>
    </div>
  )
}
