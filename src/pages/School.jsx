import React, { useEffect, useMemo, useState } from 'react'
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

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function School() {
  const { docs, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('assignments')
  const {
    docs: subjects, fetchDocs: fetchSubjects, addDocument: addSubject,
    updateDocument: updateSubject, deleteDocument: deleteSubject,
  } = useFirestore('subjects')

  const [showModal, setShowModal] = useState(false)
  const [showSubjects, setShowSubjects] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '', dueDate: '', priority: 'Medium', notes: '', color: SUBJECT_COLORS[0] })
  const [subjForm, setSubjForm] = useState({ name: '', color: SUBJECT_COLORS[0] })

  const [filterSubject, setFilterSubject] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all') // all | pending | done | overdue
  const [sortBy, setSortBy] = useState('due') // due | priority

  useEffect(() => { fetchDocs(); fetchSubjects() }, [fetchDocs, fetchSubjects])

  const today = localToday()
  const weekEnd = shiftDays(today, 7)
  const isOverdue = (a) => a.dueDate && a.dueDate < today && !a.done

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

  // Pick subject from managed list -> also set matching color.
  function pickSubject(name) {
    const s = subjects.find(x => x.name === name)
    setForm(f => ({ ...f, subject: name, color: s?.color || f.color }))
  }

  async function handleAddSubject(e) {
    e.preventDefault()
    if (!subjForm.name.trim()) return
    if (subjects.some(s => s.name.toLowerCase() === subjForm.name.trim().toLowerCase())) return
    await addSubject({ name: subjForm.name.trim(), color: subjForm.color })
    setSubjForm({ name: '', color: SUBJECT_COLORS[0] })
  }

  const priorityColor = (p) => PRIORITIES.find(x => x.label === p)?.color || '#EAB308'
  const daysUntil = (date) => {
    if (!date) return null
    return Math.ceil((new Date(date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
  }

  // Apply filters + sort.
  const visible = useMemo(() => {
    let list = [...docs]
    if (filterSubject !== 'all') list = list.filter(a => a.subject === filterSubject)
    if (filterStatus === 'pending') list = list.filter(a => !a.done)
    else if (filterStatus === 'done') list = list.filter(a => a.done)
    else if (filterStatus === 'overdue') list = list.filter(isOverdue)
    list.sort((a, b) => {
      if (sortBy === 'priority') {
        const pa = PRIORITIES.findIndex(p => p.label === a.priority)
        const pb = PRIORITIES.findIndex(p => p.label === b.priority)
        if (pa !== pb) return pb - pa
      }
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
    })
    return list
  }, [docs, filterSubject, filterStatus, sortBy, today])

  const pending = visible.filter(a => !a.done)
  const done = visible.filter(a => a.done)

  // Group pending into buckets.
  const groups = useMemo(() => {
    const g = { Overdue: [], Today: [], 'This week': [], Later: [] }
    for (const a of pending) {
      if (isOverdue(a)) g.Overdue.push(a)
      else if (a.dueDate === today) g.Today.push(a)
      else if (a.dueDate && a.dueDate <= weekEnd) g['This week'].push(a)
      else g.Later.push(a)
    }
    return g
  }, [pending, today, weekEnd])

  const overdueCount = docs.filter(isOverdue).length

  function AssignmentCard(a) {
    return (
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
    )
  }

  const selectClass = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs focus:border-[#3B82F6] transition-colors'

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>School</h1>
          <p className="text-white/40 text-sm mt-1">
            {docs.filter(a => !a.done).length} pending{overdueCount > 0 ? ' · ' : ''}
            {overdueCount > 0 && <span className="text-red-400">{overdueCount} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSubjects(true)}
            className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white/50 bg-white/5 border border-white/10"
            aria-label="Manage subjects">📚</button>
          <button onClick={() => setShowModal(true)}
            className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>+</button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner color={COLOR} size={32} /></div>}

      {/* Filter + sort controls */}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={selectClass}>
            <option value="all">All subjects</option>
            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            {/* include free-text subjects not in managed list */}
            {[...new Set(docs.map(a => a.subject).filter(Boolean))]
              .filter(name => !subjects.some(s => s.name === name))
              .map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selectClass}>
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>
      )}

      <div className="space-y-3">
        {filterStatus !== 'done' && ['Overdue', 'Today', 'This week', 'Later'].map(group => (
          groups[group].length > 0 && (
            <div key={group} className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest pt-1"
                style={{ color: group === 'Overdue' ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>
                {group} ({groups[group].length})
              </div>
              {groups[group].map(AssignmentCard)}
            </div>
          )
        ))}

        {(filterStatus === 'all' || filterStatus === 'done') && done.length > 0 && (
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
        {!loading && docs.length > 0 && visible.length === 0 && (
          <div className="text-center py-12 text-white/30">
            <p className="font-semibold">Nothing matches your filters</p>
          </div>
        )}
      </div>

      {/* Add assignment modal */}
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
              {subjects.length > 0 ? (
                <select value={form.subject} onChange={e => pickSubject(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-[#3B82F6] transition-colors">
                  <option value="">Select...</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) : (
                <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#3B82F6] transition-colors"
                  placeholder="Math, English..." />
              )}
            </div>
            <div className="w-36">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-[#3B82F6] transition-colors" />
            </div>
          </div>
          {subjects.length === 0 && (
            <p className="text-[11px] text-white/30 -mt-2">Tip: tap 📚 to manage subjects with colors.</p>
          )}
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

      {/* Manage subjects modal */}
      <Modal isOpen={showSubjects} onClose={() => setShowSubjects(false)} title="Manage Subjects" accentColor={COLOR}>
        <div className="space-y-4">
          <form onSubmit={handleAddSubject} className="space-y-3">
            <input type="text" value={subjForm.name} onChange={e => setSubjForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Subject name..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#3B82F6] transition-colors" />
            <div className="flex gap-3">
              {SUBJECT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setSubjForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-full btn-press transition-all"
                  style={{
                    background: c,
                    boxShadow: subjForm.color === c ? `0 0 14px ${c}` : 'none',
                    transform: subjForm.color === c ? 'scale(1.25)' : 'scale(1)',
                  }} />
              ))}
            </div>
            <button type="submit" className="btn-press w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${COLOR}, #2563EB)` }}>
              Add Subject
            </button>
          </form>

          <div className="space-y-2">
            {subjects.length === 0 && <p className="text-sm text-white/35 text-center py-2">No subjects yet.</p>}
            {subjects.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="flex gap-1.5 flex-shrink-0">
                  {SUBJECT_COLORS.map(c => (
                    <button key={c} onClick={() => updateSubject(s.id, { color: c })}
                      className="w-4 h-4 rounded-full btn-press"
                      style={{ background: c, outline: s.color === c ? '2px solid #fff' : 'none', outlineOffset: '1px' }} />
                  ))}
                </div>
                <span className="flex-1 text-sm font-semibold text-white truncate">{s.name}</span>
                <button onClick={() => deleteSubject(s.id)} className="text-white/20 hover:text-red-400 transition-colors text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
