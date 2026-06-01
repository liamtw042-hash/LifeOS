import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#3B82F6'

const PRIORITIES = [
  { label: 'Low', color: '#10B981' },
  { label: 'Medium', color: '#EAB308' },
  { label: 'High', color: '#EF4444' },
]

const SUBJECT_COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F97316', '#EC4899', '#EAB308', '#3B82F6']

export default function School() {
  const { docs, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('assignments')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '', dueDate: '', priority: 'Medium', notes: '', color: SUBJECT_COLORS[0] })

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    await addDocument({ ...form, done: false })
    setShowModal(false)
    setForm({ title: '', subject: '', dueDate: '', priority: 'Medium', notes: '', color: SUBJECT_COLORS[0] })
  }

  async function toggleDone(a) {
    await updateDocument(a.id, { done: !a.done })
  }

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = (a) => a.dueDate && a.dueDate < today && !a.done

  const active = [...docs.filter(a => !a.done)].sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1
    if (!isOverdue(a) && isOverdue(b)) return 1
    const pa = PRIORITIES.findIndex(p => p.label === a.priority)
    const pb = PRIORITIES.findIndex(p => p.label === b.priority)
    if (pa !== pb) return pb - pa
    return (a.dueDate || '').localeCompare(b.dueDate || '')
  })
  const done = docs.filter(a => a.done)

  const priorityColor = (p) => PRIORITIES.find(x => x.label === p)?.color || '#EAB308'

  const daysUntil = (date) => {
    if (!date) return null
    const diff = Math.ceil((new Date(date) - new Date(today)) / 86400000)
    return diff
  }

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>School</h1>
          <p className="text-white/40 text-sm mt-1">
            {active.length} pending{active.filter(isOverdue).length > 0 ? ` · ` : ''}
            {active.filter(isOverdue).length > 0 && <span className="text-red-400">{active.filter(isOverdue).length} overdue</span>}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>+</button>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner color={COLOR} size={32} /></div>}

      <div className="space-y-3">
        {active.map(a => (
          <Card key={a.id} accentColor={isOverdue(a) ? '#EF4444' : a.color || COLOR} className="p-4">
            <div className="flex items-start gap-3">
              <button onClick={() => toggleDone(a)}
                className="btn-press w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                style={{ borderColor: isOverdue(a) ? '#EF4444' : a.color || COLOR }}>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-white text-sm">{a.title}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${priorityColor(a.priority)}18`, color: priorityColor(a.priority) }}>
                    {a.priority}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5">
                  {a.subject && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${a.color || COLOR}18`, color: a.color || COLOR }}>
                      {a.subject}
                    </span>
                  )}
                  {a.dueDate && (() => {
                    const d = daysUntil(a.dueDate)
                    return (
                      <span className={`text-xs font-semibold ${isOverdue(a) ? 'text-red-400' : d <= 2 ? 'text-yellow-400' : 'text-white/35'}`}>
                        {isOverdue(a) ? `⚠️ ${Math.abs(d)}d overdue` : d === 0 ? '⚡ Due today' : d === 1 ? '⏰ Due tomorrow' : `Due ${a.dueDate}`}
                      </span>
                    )
                  })()}
                </div>
                {a.notes && <p className="text-xs text-white/35 mt-1">{a.notes}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => toggleDone(a)} className="btn-press text-xs font-semibold py-1 px-3 rounded-full transition-all"
                style={{ background: `${a.color || COLOR}18`, color: a.color || COLOR }}>
                Mark done
              </button>
              <button onClick={() => deleteDocument(a.id)} className="text-[10px] text-white/15 hover:text-red-400 transition-colors">
                Delete
              </button>
            </div>
          </Card>
        ))}

        {done.length > 0 && (
          <>
            <div className="text-xs font-bold text-white/25 uppercase tracking-widest pt-3">Completed ({done.length})</div>
            {done.map(a => (
              <Card key={a.id} className="p-3 opacity-60">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleDone(a)}
                    className="btn-press w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: '#10B981' }}>
                    <span className="text-white text-xs font-black">✓</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white/40 line-through text-sm truncate">{a.title}</p>
                    {a.subject && <p className="text-[10px] text-white/20 mt-0.5">{a.subject}</p>}
                  </div>
                  <button onClick={() => deleteDocument(a.id)} className="text-white/15 hover:text-red-400 transition-colors text-xs">✕</button>
                </div>
              </Card>
            ))}
          </>
        )}

        {!loading && docs.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-3">🎓</div>
            <p className="font-semibold">No assignments yet</p>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Assignment" accentColor={COLOR}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Title</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#3B82F6] transition-colors"
              placeholder="Assignment name..." />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Subject</label>
              <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#3B82F6] transition-colors"
                placeholder="Math, English..." />
            </div>
            <div className="w-36">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-[#3B82F6] transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-widest">Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map(p => (
                <button key={p.label} type="button" onClick={() => setForm(f => ({ ...f, priority: p.label }))}
                  className="btn-press py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: form.priority === p.label ? `${p.color}22` : 'rgba(255,255,255,0.04)',
                    color: form.priority === p.label ? p.color : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${form.priority === p.label ? p.color + '50' : 'transparent'}`,
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-widest">Subject Color</label>
            <div className="flex gap-3">
              {SUBJECT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-full btn-press transition-all"
                  style={{
                    background: c,
                    boxShadow: form.color === c ? `0 0 14px ${c}` : 'none',
                    transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#3B82F6] transition-colors"
              placeholder="Optional details..." />
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #2563EB)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Add Assignment
          </button>
        </form>
      </Modal>
    </div>
  )
}
