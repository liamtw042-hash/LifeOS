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
  const [form, setForm] = useState({
    title: '',
    subject: '',
    dueDate: '',
    priority: 'Medium',
    notes: '',
    color: SUBJECT_COLORS[0],
  })

  useEffect(() => { fetchDocs() }, [])

  async function saveAssignment(e) {
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

  const active = docs
    .filter((a) => !a.done)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

  const done = docs.filter((a) => a.done)

  function priorityColor(p) {
    return PRIORITIES.find((x) => x.label === p)?.color || '#EAB308'
  }

  function isOverdue(a) {
    return a.dueDate && a.dueDate < today && !a.done
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">School</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {active.length} pending · {done.length} done
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}40` }}
        >
          + Add
        </button>
      </div>

      {loading ? (
        <LoadingSpinner color={COLOR} />
      ) : active.length === 0 && done.length === 0 ? (
        <Card color={COLOR}>
          <div className="text-center py-8 text-white/30">
            <div className="text-4xl mb-3">🎓</div>
            <p className="text-sm">No assignments yet!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((a) => (
            <Card key={a.id} color={isOverdue(a) ? '#EF4444' : a.color || COLOR}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleDone(a)}
                  className="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={{ borderColor: a.color || COLOR }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-white truncate">{a.title}</p>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: `${priorityColor(a.priority)}20`,
                        color: priorityColor(a.priority),
                      }}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {a.subject && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${a.color || COLOR}20`, color: a.color || COLOR }}
                      >
                        {a.subject}
                      </span>
                    )}
                    {a.dueDate && (
                      <span className={`text-xs ${isOverdue(a) ? 'text-red-400 font-bold' : 'text-white/40'}`}>
                        {isOverdue(a) ? '⚠️ ' : ''}Due {a.dueDate}
                      </span>
                    )}
                  </div>
                  {a.notes && <p className="text-xs text-white/40 mt-1">{a.notes}</p>}
                </div>
              </div>
              <button
                onClick={() => deleteDocument(a.id)}
                className="mt-2 text-xs text-white/20 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </Card>
          ))}

          {done.length > 0 && (
            <>
              <p className="text-xs text-white/30 uppercase tracking-widest pt-2">Completed</p>
              {done.map((a) => (
                <Card key={a.id} color="#10B981">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleDone(a)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                      style={{ background: '#10B981' }}
                    >
                      <span className="text-white text-xs font-bold">✓</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white/40 line-through truncate">{a.title}</p>
                      {a.subject && <p className="text-xs text-white/20 mt-0.5">{a.subject}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Assignment" color={COLOR}>
        <form onSubmit={saveAssignment} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Assignment name..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Math, English, Science..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Priority</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p.label }))}
                  className="py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: form.priority === p.label ? p.color : 'rgba(255,255,255,0.05)',
                    color: form.priority === p.label ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Subject Color</label>
            <div className="flex gap-3 mt-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    boxShadow: form.color === c ? `0 0 12px ${c}` : 'none',
                    transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{ background: COLOR }}
          >
            Add Assignment
          </button>
        </form>
      </Modal>
    </div>
  )
}
