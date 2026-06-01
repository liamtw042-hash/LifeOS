import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#EC4899'

const COLUMNS = ['To Do', 'In Progress', 'Done']
const COL_ICONS = { 'To Do': '📋', 'In Progress': '⚡', 'Done': '✅' }
const COL_COLORS = { 'To Do': 'rgba(255,255,255,0.25)', 'In Progress': COLOR, 'Done': '#10B981' }

const TAG_COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F97316', '#EC4899', '#EAB308', '#3B82F6']

export default function Projects() {
  const { docs, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('projects')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', color: TAG_COLORS[0], status: 'To Do' })

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    await addDocument(form)
    setShowModal(false)
    setForm({ title: '', description: '', color: TAG_COLORS[0], status: 'To Do' })
  }

  async function moveCard(card, dir) {
    const idx = COLUMNS.indexOf(card.status)
    const next = COLUMNS[idx + dir]
    if (next) await updateDocument(card.id, { status: next })
  }

  const counts = COLUMNS.reduce((acc, col) => {
    acc[col] = docs.filter(d => d.status === col).length
    return acc
  }, {})

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Projects</h1>
          <p className="text-white/40 text-sm mt-1">{docs.length} cards · {counts['Done']} done</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>+</button>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner color={COLOR} size={32} /></div>}

      {/* Summary strip */}
      {!loading && docs.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-6">
          {COLUMNS.map(col => (
            <Card key={col} className="py-3 text-center">
              <div className="font-black text-xl" style={{ color: COL_COLORS[col] }}>{counts[col]}</div>
              <div className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{col}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Columns */}
      <div className="space-y-6">
        {COLUMNS.map(col => {
          const cards = docs.filter(d => d.status === col)
          const colIdx = COLUMNS.indexOf(col)
          return (
            <div key={col}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">{COL_ICONS[col]}</span>
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: COL_COLORS[col] }}>{col}</h2>
                <span className="text-xs text-white/20">({cards.length})</span>
              </div>
              {cards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/08 py-5 text-center text-white/20 text-xs">
                  No cards
                </div>
              ) : (
                <div className="space-y-2">
                  {cards.map(card => (
                    <Card key={card.id} accentColor={card.color || COLOR} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: card.color || COLOR, boxShadow: `0 0 6px ${card.color || COLOR}` }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{card.title}</p>
                          {card.description && <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{card.description}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {colIdx > 0 && (
                            <button onClick={() => moveCard(card, -1)}
                              className="btn-press w-7 h-7 rounded-lg bg-white/05 hover:bg-white/10 text-white/40 flex items-center justify-center text-xs transition-all">
                              ←
                            </button>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <button onClick={() => moveCard(card, 1)}
                              className="btn-press w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all"
                              style={{ background: `${card.color || COLOR}30` }}>
                              →
                            </button>
                          )}
                        </div>
                      </div>
                      <button onClick={() => deleteDocument(card.id)}
                        className="mt-2 text-[10px] text-white/15 hover:text-red-400 transition-colors">
                        Delete
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && docs.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-semibold">Add your first project card</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Project Card" accentColor={COLOR}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Title</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#EC4899] transition-colors"
              placeholder="What needs to be done?" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Details, context, links..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#EC4899] transition-colors resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-widest">Start In</label>
            <div className="grid grid-cols-3 gap-2">
              {COLUMNS.map(col => (
                <button key={col} type="button" onClick={() => setForm(f => ({ ...f, status: col }))}
                  className="btn-press py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: form.status === col ? `${COL_COLORS[col]}25` : 'rgba(255,255,255,0.04)',
                    color: form.status === col ? COL_COLORS[col] : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${form.status === col ? COL_COLORS[col] + '60' : 'transparent'}`,
                  }}>
                  {col}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-widest">Color Tag</label>
            <div className="flex gap-3">
              {TAG_COLORS.map(c => (
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
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #DB2777)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Add Card
          </button>
        </form>
      </Modal>
    </div>
  )
}
