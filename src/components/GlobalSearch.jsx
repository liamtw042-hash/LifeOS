import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { useFirestore } from '../hooks/useFirestore'
import { FOODS } from '../data/foods'

const COLOR = '#7C3AED'

function useDebounced(value, delay = 180) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const norm = (s) => String(s || '').toLowerCase()

export default function GlobalSearch({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim())

  const { docs: customFoods, fetchDocs: fetchCustomFoods } = useFirestore('customFoods')
  const { docs: recipes, fetchDocs: fetchRecipes } = useFirestore('recipes')
  const { docs: customWorkouts, fetchDocs: fetchWorkouts } = useFirestore('customWorkouts')
  const { docs: journal, fetchDocs: fetchJournal } = useFirestore('journal')
  const { docs: assignments, fetchDocs: fetchAssignments } = useFirestore('assignments')

  // Load searchable data whenever the palette opens.
  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    fetchCustomFoods()
    fetchRecipes()
    fetchWorkouts()
    fetchJournal()
    fetchAssignments()
  }, [isOpen, fetchCustomFoods, fetchRecipes, fetchWorkouts, fetchJournal, fetchAssignments])

  const results = useMemo(() => {
    const q = norm(debounced)
    if (!q) return null

    const match = (...fields) => fields.some((f) => norm(f).includes(q))

    const foods = [
      ...(Array.isArray(FOODS) ? FOODS : []),
      ...((customFoods || []).map((c) => ({ ...c, custom: true }))),
    ]
      .filter((f) => f && match(f.name, ...(Array.isArray(f.aliases) ? f.aliases : [])))
      .slice(0, 6)

    const recipeHits = (recipes || [])
      .filter((r) => r && match(r.name))
      .slice(0, 5)

    const workoutHits = (customWorkouts || [])
      .filter((w) => w && match(w.name))
      .slice(0, 5)

    const journalHits = (journal || [])
      .filter((j) => j && match(j.text, j.date))
      .sort((a, b) => norm(b.date).localeCompare(norm(a.date)))
      .slice(0, 5)

    const assignmentHits = (assignments || [])
      .filter((a) => a && match(a.title, a.subject))
      .slice(0, 5)

    const total =
      foods.length + recipeHits.length + workoutHits.length + journalHits.length + assignmentHits.length

    return { foods, recipeHits, workoutHits, journalHits, assignmentHits, total }
  }, [debounced, customFoods, recipes, customWorkouts, journal, assignments])

  function go(to, state) {
    onClose?.()
    navigate(to, state ? { state } : undefined)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search" accentColor={COLOR}>
      <div className="space-y-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods, recipes, workouts, journal, school…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
          autoFocus
        />

        {!debounced && (
          <p className="text-sm text-white/35 py-4 text-center">
            Start typing to search across your whole LifeOS.
          </p>
        )}

        {debounced && results && results.total === 0 && (
          <p className="text-sm text-white/35 py-4 text-center">No matches for “{debounced}”.</p>
        )}

        {debounced && results && results.total > 0 && (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto -mx-1 px-1">
            <ResultGroup title="Foods" icon="🍽️" items={results.foods}
              render={(f) => (
                <Row key={`food-${f.name}`} title={f.name}
                  sub={`${Math.round(Number(f.cal) || 0)} cal${f.custom ? ' · custom' : ''}`}
                  onClick={() => go('/fitness', { tab: 'food' })} />
              )} />

            <ResultGroup title="Recipes" icon="📖" items={results.recipeHits}
              render={(r) => (
                <Row key={`recipe-${r.id}`} title={r.name}
                  sub={`${(r.items || []).length} items`}
                  onClick={() => go('/fitness', { tab: 'food' })} />
              )} />

            <ResultGroup title="Workouts" icon="💪" items={results.workoutHits}
              render={(w) => (
                <Row key={`workout-${w.id}`} title={w.name}
                  sub={`${(w.exercises || []).length} exercises`}
                  onClick={() => go('/fitness', { tab: 'train' })} />
              )} />

            <ResultGroup title="Journal" icon="📓" items={results.journalHits}
              render={(j) => (
                <Row key={`journal-${j.id}`} title={j.text} sub={j.date}
                  onClick={() => go('/journal')} />
              )} />

            <ResultGroup title="School" icon="🎓" items={results.assignmentHits}
              render={(a) => (
                <Row key={`assign-${a.id}`} title={a.title}
                  sub={[a.subject, a.dueDate ? `due ${a.dueDate}` : ''].filter(Boolean).join(' · ')}
                  onClick={() => go('/school')} />
              )} />
          </div>
        )}
      </div>
    </Modal>
  )
}

function ResultGroup({ title, icon, items, render }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-white/40">{title}</span>
      </div>
      <div className="space-y-1.5">{items.map(render)}</div>
    </div>
  )
}

function Row({ title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn-press w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white truncate">{title || 'Untitled'}</div>
        {sub && <div className="text-[11px] text-white/40 truncate">{sub}</div>}
      </div>
      <span className="text-white/30 text-sm flex-shrink-0">→</span>
    </button>
  )
}
