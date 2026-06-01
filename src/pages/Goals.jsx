import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#7C3AED'

export default function Goals() {
  const { docs: goals, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('goals')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ emoji: '🎯', title: '', description: '', targetDate: '', progress: 0, milestones: [] })
  const [newMilestone, setNewMilestone] = useState('')

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleAdd(e) {
    e.preventDefault()
    await addDocument(form)
    setForm({ emoji: '🎯', title: '', description: '', targetDate: '', progress: 0, milestones: [] })
    setShowModal(false)
  }

  async function updateProgress(id, progress) {
    await updateDocument(id, { progress })
  }

  async function toggleMilestone(goal, idx) {
    const milestones = [...(goal.milestones || [])]
    milestones[idx] = { ...milestones[idx], done: !milestones[idx].done }
    await updateDocument(goal.id, { milestones })
  }

  function addMilestone() {
    if (!newMilestone.trim()) return
    setForm(f => ({ ...f, milestones: [...f.milestones, { text: newMilestone.trim(), done: false }] }))
    setNewMilestone('')
  }

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Goals</h1>
          <p className="text-white/40 text-sm mt-1">{goals.filter(g => g.progress < 100).length} active</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}
        >+</button>
      </div>

      {loading && <div className="flex justify-center py-12"><LoadingSpinner color={COLOR} size={32} /></div>}

      <div className="space-y-4">
        {goals.map((goal) => (
          <Card key={goal.id} accentColor={COLOR} hover className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl flex-shrink-0">{goal.emoji || '🎯'}</span>
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">{goal.title}</h3>
                  {goal.description && <p className="text-white/40 text-xs mt-0.5 truncate">{goal.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {goal.progress >= 100 && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">Done!</span>}
                <button
                  onClick={() => deleteDocument(goal.id)}
                  className="text-white/20 hover:text-red-400 transition-colors text-sm"
                >✕</button>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Progress</span>
                <span className="text-xs font-bold" style={{ color: COLOR }}>{goal.progress || 0}%</span>
              </div>
              <input
                type="range" min="0" max="100"
                value={goal.progress || 0}
                onChange={(e) => updateProgress(goal.id, parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: COLOR, background: `linear-gradient(to right, ${COLOR} ${goal.progress || 0}%, rgba(255,255,255,0.1) ${goal.progress || 0}%)` }}
              />
            </div>

            {/* Target date */}
            {goal.targetDate && (
              <div className="text-xs text-white/30">
                🎯 Target: {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}

            {/* Milestones */}
            {(goal.milestones || []).length > 0 && (
              <div className="space-y-1.5">
                {goal.milestones.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => toggleMilestone(goal, i)}
                    className="btn-press flex items-center gap-2 w-full text-left"
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: m.done ? COLOR : 'rgba(255,255,255,0.1)', border: `1px solid ${m.done ? COLOR : 'rgba(255,255,255,0.2)'}` }}>
                      {m.done && <span className="text-white text-xs animate-checkmark">✓</span>}
                    </div>
                    <span className={`text-sm ${m.done ? 'line-through text-white/30' : 'text-white/70'}`}>{m.text}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
        {!loading && goals.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-3">🎯</div>
            <p className="font-semibold">Set your first goal</p>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Goal" accentColor={COLOR}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Emoji</label>
              <input type="text" value={form.emoji} onChange={e => setForm(f => ({...f, emoji: e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg" maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Title</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
                placeholder="Goal name" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:border-[#7C3AED] transition-colors"
              placeholder="Why does this matter?" rows={2} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Target Date</label>
            <input type="date" value={form.targetDate} onChange={e => setForm(f => ({...f, targetDate: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Milestones</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
                placeholder="Add a milestone..." />
              <button type="button" onClick={addMilestone}
                className="btn-press px-4 py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: COLOR }}>+</button>
            </div>
            {form.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-white/50 text-xs flex-1">{m.text}</span>
                <button type="button" onClick={() => setForm(f => ({...f, milestones: f.milestones.filter((_, j) => j !== i)}))}
                  className="text-white/20 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
          <button type="submit"
            className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #4F46E5)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Add Goal
          </button>
        </form>
      </Modal>
    </div>
  )
}
