import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#EC4899'

const COLUMNS = ['To Do', 'In Progress', 'Done']

const TAG_COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F97316', '#EC4899', '#EAB308', '#3B82F6']

export default function Projects() {
  const { docs, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('projects')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', color: TAG_COLORS[0], status: 'To Do' })

  useEffect(() => { fetchDocs() }, [])

  async function saveProject(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    await addDocument(form)
    setShowModal(false)
    setForm({ title: '', description: '', color: TAG_COLORS[0], status: 'To Do' })
  }

  async function moveCard(card, direction) {
    const idx = COLUMNS.indexOf(card.status)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= COLUMNS.length) return
    await updateDocument(card.id, { status: COLUMNS[newIdx] })
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Projects</h1>
          <p className="text-sm text-white/40 mt-0.5">{docs.length} cards</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}40` }}
        >
          + Add Card
        </button>
      </div>

      {loading ? (
        <LoadingSpinner color={COLOR} />
      ) : (
        <div className="space-y-6">
          {COLUMNS.map((col) => {
            const cards = docs.filter((d) => d.status === col)
            return (
              <div key={col}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background:
                        col === 'Done' ? '#10B981' : col === 'In Progress' ? COLOR : 'rgba(255,255,255,0.3)',
                    }}
                  />
                  <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest">{col}</h2>
                  <span className="text-xs text-white/20">({cards.length})</span>
                </div>

                {cards.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-white/10 py-6 text-center text-white/20 text-sm"
                  >
                    No cards here
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cards.map((card) => {
                      const colIdx = COLUMNS.indexOf(card.status)
                      return (
                        <Card key={card.id} color={card.color || COLOR}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                                style={{ background: card.color || COLOR }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-white truncate">{card.title}</p>
                                {card.description && (
                                  <p className="text-xs text-white/40 mt-1 line-clamp-2">{card.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              {colIdx > 0 && (
                                <button
                                  onClick={() => moveCard(card, -1)}
                                  className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-all"
                                >
                                  ←
                                </button>
                              )}
                              {colIdx < COLUMNS.length - 1 && (
                                <button
                                  onClick={() => moveCard(card, 1)}
                                  className="text-xs px-2 py-1 rounded-lg text-white font-semibold transition-all"
                                  style={{ background: `${card.color || COLOR}30` }}
                                >
                                  →
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteDocument(card.id)}
                            className="mt-2 text-xs text-white/20 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Project Card" color={COLOR}>
        <form onSubmit={saveProject} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Project name..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-pink-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What needs to happen..."
              rows={3}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-pink-500 resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Column</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {COLUMNS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: col }))}
                  className="py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: form.status === col ? COLOR : 'rgba(255,255,255,0.05)',
                    color: form.status === col ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Color Tag</label>
            <div className="flex gap-3 mt-2">
              {TAG_COLORS.map((c) => (
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
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{ background: COLOR }}
          >
            Add Card
          </button>
        </form>
      </Modal>
    </div>
  )
}
