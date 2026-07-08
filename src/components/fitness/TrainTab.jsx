import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import Card from '../Card'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import RestTimer from './RestTimer'
import { LineChart, BarChart } from '../charts/Charts'
import {
  SPLIT,
  WORKOUTS,
  BODYWEIGHT,
  DAY_ORDER,
  DAY_LABELS,
  restSeconds,
  ALL_EXERCISES,
} from '../../data/trainingProgram'
import {
  todayDayKey,
  epley1RM,
  workingWeights,
  suggestNextWeight,
  isPR,
  estimateVolume,
  personalRecords,
  exerciseHistory,
  lastSessionSets,
  plateBreakdown,
  warmupSets,
  KG_PLATES,
} from '../../lib/training'

const COLOR = '#7C3AED'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Pick the reference set from a past session (the heaviest by est 1RM).
function bestSet(sets) {
  let best = null
  for (const s of sets || []) {
    if (s.warmup) continue
    if (!best || epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps)) best = s
  }
  return best
}

// Build the working session (array of exercise entries) from a template.
function buildSession(workoutArr, history) {
  return (workoutArr || []).map((ex) => {
    const last = lastSessionSets(ex.name, history)
    const ref = bestSet(last)
    const suggested = ref
      ? suggestNextWeight(ref.weight, ref.reps, ex.repRange?.[1], ex.type)
      : 0
    const count = ex.sets || 3
    const sets = Array.from({ length: count }).map(() => ({
      weight: suggested ? String(suggested) : '',
      reps: '',
      done: false,
    }))
    return {
      base: ex,
      optIndex: 0, // 0 = original name, >0 = alternatives[optIndex-1]
      name: ex.name,
      muscle: ex.muscle,
      type: ex.type || 'compound',
      repRange: ex.repRange || [8, 12],
      isTime: !!ex.isTime,
      tip: ex.tip,
      tipOpen: false,
      superset: null, // superset group id (letter)
      lastSets: last,
      sets,
    }
  })
}

export default function TrainTab() {
  const { docs: sessions, loading, fetchDocs, addDocument } = useFirestore('workoutSessions')
  const {
    docs: customWorkouts,
    fetchDocs: fetchCustom,
    addDocument: addCustom,
    updateDocument: updateCustom,
    deleteDocument: deleteCustom,
  } = useFirestore('customWorkouts')

  const [selectedDay, setSelectedDay] = useState(todayDayKey())
  // Workout source: 'today' (auto split) | 'custom' | 'bodyweight'
  const [source, setSource] = useState('today')
  const [activeCustom, setActiveCustom] = useState(null) // the custom workout being trained
  const [session, setSession] = useState([])
  const [startedAt, setStartedAt] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const [notes, setNotes] = useState('')

  const [rest, setRest] = useState(null) // { seconds }
  const [summary, setSummary] = useState(null)
  const [showPR, setShowPR] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [showPlates, setShowPlates] = useState(false) // false | true | { weight }
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingCustom, setEditingCustom] = useState(null) // doc being edited in builder
  const [historyFor, setHistoryFor] = useState(null) // exercise name

  const readyRef = useRef(false)
  const sessionsRef = useRef([])
  sessionsRef.current = sessions

  useEffect(() => { fetchDocs(); fetchCustom() }, [fetchDocs, fetchCustom])

  // Flip ready once history has loaded the first time.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!loading && !readyRef.current) {
      readyRef.current = true
      setReady(true)
    }
  }, [loading])

  const isRestDay = source === 'today' && SPLIT[selectedDay] === 'Rest'
  const workoutName =
    source === 'bodyweight'
      ? 'Bodyweight'
      : source === 'custom'
        ? (activeCustom?.name || 'Custom')
        : SPLIT[selectedDay]

  // (Re)build the session when the source, day, custom, or first-load changes.
  useEffect(() => {
    if (source === 'bodyweight') {
      setSession(buildSession(BODYWEIGHT, sessionsRef.current))
    } else if (source === 'custom') {
      setSession(buildSession(activeCustom?.exercises || [], sessionsRef.current))
    } else if (SPLIT[selectedDay] === 'Rest') {
      setSession([])
    } else {
      setSession(buildSession(WORKOUTS[SPLIT[selectedDay]], sessionsRef.current))
    }
    setStartedAt(null)
    setNotes('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, source, activeCustom, ready])

  // Live elapsed clock while a workout is in progress.
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  function ensureStarted() {
    if (!startedAt) setStartedAt(Date.now())
  }

  // ---- set mutations ----
  function mutate(exIdx, fn) {
    setSession((prev) => prev.map((ex, i) => (i === exIdx ? fn(ex) : ex)))
  }
  function updateSet(exIdx, setIdx, field, value) {
    mutate(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)),
    }))
  }
  function toggleDone(exIdx, setIdx) {
    ensureStarted()
    mutate(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, done: !s.done } : s)),
    }))
  }
  function addSet(exIdx) {
    mutate(exIdx, (ex) => {
      const last = ex.sets[ex.sets.length - 1]
      return { ...ex, sets: [...ex.sets, { weight: last?.weight || '', reps: '', done: false }] }
    })
  }
  function removeSet(exIdx, setIdx) {
    mutate(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.length > 1 ? ex.sets.filter((_, i) => i !== setIdx) : ex.sets,
    }))
  }
  function toggleTip(exIdx) {
    mutate(exIdx, (ex) => ({ ...ex, tipOpen: !ex.tipOpen }))
  }
  // Prepend generated warmup sets (marked warmup:true) ahead of work sets.
  function addWarmups(exIdx) {
    mutate(exIdx, (ex) => {
      const working = ex.sets.find((s) => !s.warmup && Number(s.weight) > 0)
      const ref = Number(working?.weight) || 0
      if (ref <= 0) return ex
      const warm = warmupSets(ref, ex.type).map((w) => ({
        weight: w.weight ? String(w.weight) : '',
        reps: String(w.reps),
        done: false,
        warmup: true,
      }))
      if (!warm.length) return ex
      const rest = ex.sets.filter((s) => !s.warmup)
      return { ...ex, sets: [...warm, ...rest] }
    })
  }
  // Toggle a superset link between exercise exIdx and the next one.
  function toggleSuperset(exIdx) {
    setSession((prev) => {
      if (exIdx >= prev.length - 1) return prev
      const linked = prev[exIdx].superset && prev[exIdx].superset === prev[exIdx + 1].superset
      if (linked) {
        return prev.map((ex, i) =>
          i === exIdx || i === exIdx + 1 ? { ...ex, superset: null } : ex
        )
      }
      // Assign a fresh group id (letter) based on existing groups.
      const used = new Set(prev.map((e) => e.superset).filter(Boolean))
      let code = 65
      while (used.has(String.fromCharCode(code))) code += 1
      const gid = String.fromCharCode(code)
      return prev.map((ex, i) =>
        i === exIdx || i === exIdx + 1 ? { ...ex, superset: gid } : ex
      )
    })
  }
  function swapExercise(exIdx) {
    mutate(exIdx, (ex) => {
      const opts = [ex.base.name, ...(ex.base.alternatives || [])]
      if (opts.length <= 1) return ex
      const next = (ex.optIndex + 1) % opts.length
      const nextName = opts[next]
      const nextLast = lastSessionSets(nextName, sessionsRef.current)
      const ref = bestSet(nextLast)
      const suggested = ref
        ? suggestNextWeight(ref.weight, ref.reps, ex.base.repRange?.[1], ex.base.type)
        : 0
      const isOriginal = next === 0
      // Alternatives target the same muscle group, so keep muscle/type/repRange
      // from the base. Replace the base-specific setup tip with a neutral note
      // (the original cue would be wrong for the alternative).
      const tip = isOriginal
        ? ex.base.tip
        : `Alternative for ${ex.base.name} — set up the cable to target ${ex.base.muscle}.`
      return {
        ...ex,
        optIndex: next,
        name: nextName,
        muscle: ex.base.muscle,
        type: ex.base.type,
        repRange: ex.base.repRange,
        tip,
        lastSets: nextLast,
        sets: ex.sets.map((s) => ({
          ...s,
          weight: suggested ? String(suggested) : s.weight,
        })),
      }
    })
  }

  // ---- finish ----
  function finishWorkout() {
    const history = sessionsRef.current
    const exercises = session
      .map((ex) => ({
        name: ex.name,
        muscle: ex.muscle,
        ...(ex.superset ? { superset: ex.superset } : {}),
        sets: ex.sets
          .filter((s) => String(s.weight) !== '' || String(s.reps) !== '' || s.done)
          .map((s) => ({
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
            done: !!s.done,
            ...(s.warmup ? { warmup: true } : {}),
          })),
      }))
      .filter((ex) => ex.sets.length)

    if (!exercises.length) {
      setSession([])
      setStartedAt(null)
      return
    }

    const prs = []
    for (const ex of exercises) {
      const ref = bestSet(ex.sets)
      if (ref && isPR(ex.name, ref.weight, ref.reps, history)) prs.push(ex.name)
    }

    const volume = estimateVolume(exercises)
    const totalSets = exercises.reduce(
      (a, ex) => a + ex.sets.filter((s) => s.done).length || 0,
      0
    ) || exercises.reduce((a, ex) => a + ex.sets.length, 0)
    const durationMin = startedAt
      ? Math.max(1, Math.round((Date.now() - startedAt) / 60000))
      : 0

    const doc = {
      date: todayStr(),
      day: source === 'custom' ? (activeCustom?.name || 'Custom') : selectedDay,
      mode: source === 'custom' ? 'custom' : source === 'bodyweight' ? 'bodyweight' : 'gym',
      exercises,
      durationMin,
      volume,
      prs,
      notes: notes.trim(),
    }
    addDocument(doc)
    setSummary({ ...doc, totalSets })
    setStartedAt(null)
    setNotes('')
    // Reset the working session to a fresh copy.
    if (source === 'bodyweight') setSession(buildSession(BODYWEIGHT, [doc, ...history]))
    else if (source === 'custom') setSession(buildSession(activeCustom?.exercises || [], [doc, ...history]))
    else if (SPLIT[selectedDay] !== 'Rest')
      setSession(buildSession(WORKOUTS[SPLIT[selectedDay]], [doc, ...history]))
  }

  const elapsedMin = startedAt ? Math.floor((nowTick - startedAt) / 60000) : 0
  const elapsedSec = startedAt ? Math.floor((nowTick - startedAt) / 1000) % 60 : 0

  const doneSetCount = useMemo(
    () => session.reduce((a, ex) => a + ex.sets.filter((s) => s.done).length, 0),
    [session]
  )
  const liveVolume = useMemo(() => {
    return estimateVolume(
      session.map((ex) => ({
        sets: ex.sets.map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, warmup: s.warmup })),
      }))
    )
  }, [session])

  const prBoard = useMemo(() => personalRecords(sessions), [sessions])
  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8),
    [sessions]
  )

  return (
    <div className="space-y-4">
      {/* Day selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {DAY_ORDER.map((d) => {
          const active = d === selectedDay && source === 'today'
          const isToday = d === todayDayKey()
          const restDay = SPLIT[d] === 'Rest'
          return (
            <button
              key={d}
              onClick={() => { setSource('today'); setSelectedDay(d) }}
              className="btn-press flex-shrink-0 px-3 py-2 rounded-xl text-center transition-all"
              style={{
                background: active ? COLOR : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? COLOR : isToday ? COLOR + '55' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: active ? `0 0 16px ${COLOR}55` : 'none',
              }}
            >
              <div className="text-[11px] font-black" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                {d}
              </div>
              <div
                className="text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: active ? 'rgba(255,255,255,0.8)' : restDay ? 'rgba(255,255,255,0.3)' : COLOR }}
              >
                {SPLIT[d]}
              </div>
            </button>
          )
        })}
      </div>

      {/* Workout source selector */}
      <div className="flex gap-2">
        {[
          { key: 'today', label: '📅 Today' },
          { key: 'custom', label: '⭐ Custom' },
          { key: 'bodyweight', label: '🏠 Home' },
        ].map((opt) => {
          const active = source === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => {
                if (opt.key === 'custom' && !activeCustom) {
                  // Need a custom workout selected first; open the picker.
                  setSource('custom')
                } else {
                  setSource(opt.key)
                }
              }}
              className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: active ? COLOR : 'rgba(255,255,255,0.05)',
                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${active ? COLOR : 'rgba(255,255,255,0.1)'}`,
                boxShadow: active ? `0 0 16px ${COLOR}55` : 'none',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Tools row */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowPR(true)}
          className="btn-press flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70"
        >
          🏆 PRs
        </button>
        <button
          onClick={() => setShowCalc(true)}
          className="btn-press flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70"
        >
          🧮 1RM
        </button>
        <button
          onClick={() => setShowPlates(true)}
          className="btn-press flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70"
        >
          🏋️ Plates
        </button>
        <button
          onClick={() => { setEditingCustom(null); setShowBuilder(true) }}
          className="btn-press flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70"
        >
          ＋ Build
        </button>
      </div>

      {/* Custom workout picker (shown when Custom source has no active workout) */}
      {source === 'custom' && (
        <CustomPicker
          workouts={customWorkouts}
          active={activeCustom}
          onStart={(w) => setActiveCustom(w)}
          onClear={() => setActiveCustom(null)}
          onEdit={(w) => { setEditingCustom(w); setShowBuilder(true) }}
          onDelete={(w) => {
            if (w?.id) deleteCustom(w.id)
            if (activeCustom?.id === w?.id) setActiveCustom(null)
          }}
          onNew={() => { setEditingCustom(null); setShowBuilder(true) }}
        />
      )}

      {loading && <div className="flex justify-center py-2"><LoadingSpinner color={COLOR} size={22} /></div>}

      {/* Rest day */}
      {isRestDay ? (
        <Card accentColor={COLOR} className="p-6 text-center">
          <div className="text-5xl mb-3">😌</div>
          <div className="text-lg font-black text-white">Rest Day</div>
          <p className="text-sm text-white/40 mt-1 mb-4">
            {DAY_LABELS[selectedDay]} is a recovery day. Grow while you rest — or train anyway.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSource('bodyweight')}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: COLOR, boxShadow: `0 0 18px ${COLOR}55` }}
            >
              Bodyweight session
            </button>
            <button
              onClick={() => { setSource('today'); setSelectedDay('Mon') }}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white/70"
            >
              Pick a workout
            </button>
          </div>
        </Card>
      ) : (source === 'custom' && !activeCustom) ? null : (
        <>
          {/* Session header */}
          <Card accentColor={COLOR} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                  {source === 'bodyweight'
                    ? 'Home workout'
                    : source === 'custom'
                      ? 'Custom workout'
                      : DAY_LABELS[selectedDay]}
                </div>
                <div className="text-xl font-black text-white">{workoutName}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tabular-nums" style={{ color: COLOR }}>
                  {startedAt ? `${elapsedMin}:${String(elapsedSec).padStart(2, '0')}` : '—'}
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest">
                  {doneSetCount} sets · {liveVolume}kg vol
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {!startedAt ? (
                <button
                  onClick={ensureStarted}
                  className="btn-press flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}50` }}
                >
                  Start Workout
                </button>
              ) : (
                <button
                  onClick={finishWorkout}
                  className="btn-press flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}50` }}
                >
                  Finish Workout
                </button>
              )}
            </div>
          </Card>

          {/* Exercises */}
          {session.map((ex, exIdx) => {
            const prev = session[exIdx - 1]
            const next = session[exIdx + 1]
            const groupStart = ex.superset && ex.superset !== prev?.superset
            const inGroup = !!ex.superset
            const canLinkNext = next && !ex.isTime && !next.isTime
            return (
              <div
                key={exIdx}
                className={inGroup ? 'pl-3' : ''}
                style={inGroup ? { borderLeft: `2px solid ${COLOR}`, marginLeft: 2 } : undefined}
              >
                {groupStart && (
                  <div className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: COLOR }}>
                    ⛓ Superset {ex.superset}
                  </div>
                )}
                <ExerciseCard
                  ex={ex}
                  exIdx={exIdx}
                  history={sessions}
                  canLinkNext={canLinkNext}
                  linked={!!(ex.superset && ex.superset === next?.superset)}
                  onToggleTip={() => toggleTip(exIdx)}
                  onSwap={() => swapExercise(exIdx)}
                  onUpdateSet={updateSet}
                  onToggleDone={toggleDone}
                  onAddSet={() => addSet(exIdx)}
                  onRemoveSet={removeSet}
                  onWarmup={() => addWarmups(exIdx)}
                  onSuperset={() => toggleSuperset(exIdx)}
                  onRest={() => setRest({ seconds: restSeconds(ex.type) })}
                  onHistory={() => setHistoryFor(ex.name)}
                  onPlates={(w) => setShowPlates({ weight: w })}
                />
              </div>
            )
          })}

          {/* Workout notes */}
          <Card accentColor={COLOR} className="p-4">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Session notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Energy, tweaks, PBs…"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#7C3AED] resize-none"
            />
          </Card>
        </>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Recent Sessions</div>
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${COLOR}18` }}>
                  {s.mode === 'bodyweight' ? '🏠' : s.mode === 'custom' ? '⭐' : '🏋️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85">
                    {s.mode === 'bodyweight' ? 'Bodyweight' : s.mode === 'custom' ? (s.day || 'Custom') : SPLIT[s.day] || s.day || 'Workout'}
                    {s.prs?.length ? <span className="ml-2 text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: COLOR, color: '#fff' }}>{s.prs.length} PR</span> : null}
                  </div>
                  <div className="text-[11px] text-white/40">
                    {s.date} · {s.durationMin || 0}min · {s.volume || 0}kg
                  </div>
                  {s.notes ? <div className="text-[11px] text-white/30 italic mt-0.5 truncate">“{s.notes}”</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rest timer modal */}
      <Modal isOpen={!!rest} onClose={() => setRest(null)} title="Rest Timer" accentColor={COLOR}>
        {rest && (
          <RestTimer seconds={rest.seconds} onClose={() => setRest(null)} />
        )}
      </Modal>

      {/* Summary modal */}
      <Modal isOpen={!!summary} onClose={() => setSummary(null)} title="Workout Complete" accentColor={COLOR}>
        {summary && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="text-5xl mb-2 animate-checkmark inline-block">💪</div>
              <div className="text-lg font-black text-white">{summary.mode === 'bodyweight' ? 'Bodyweight' : summary.mode === 'custom' ? summary.day : SPLIT[summary.day] || summary.day}</div>
              <div className="text-xs text-white/40">{summary.date}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SummaryStat label="Duration" value={`${summary.durationMin}m`} />
              <SummaryStat label="Sets" value={summary.totalSets} />
              <SummaryStat label="Volume" value={`${summary.volume}kg`} />
            </div>
            {summary.prs?.length > 0 && (
              <div className="p-3 rounded-xl" style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}40` }}>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: COLOR }}>
                  🏆 {summary.prs.length} New PR{summary.prs.length > 1 ? 's' : ''}
                </div>
                <div className="text-sm text-white/80">{summary.prs.join(', ')}</div>
              </div>
            )}
            <div className="space-y-1.5">
              {summary.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-white/75">{ex.name}</span>
                  <span className="text-white/40 text-xs">
                    {ex.sets.filter((s) => !s.warmup).length} × {ex.sets.filter((s) => !s.warmup).map((s) => `${s.weight || 'BW'}×${s.reps}`).join(', ')}
                  </span>
                </div>
              ))}
            </div>
            {summary.notes ? (
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/70 italic">“{summary.notes}”</div>
            ) : null}
            <button
              onClick={() => setSummary(null)}
              className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* PR board modal */}
      <Modal isOpen={showPR} onClose={() => setShowPR(false)} title="Personal Records" accentColor={COLOR}>
        {prBoard.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-sm font-semibold">No PRs yet — finish a workout to set your first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {prBoard.map((pr) => (
              <div key={pr.name} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85 truncate">{pr.name}</div>
                  <div className="text-[11px] text-white/40">
                    {pr.weight || 'BW'}{pr.weight ? 'kg' : ''} × {pr.reps} · {pr.date}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-black" style={{ color: COLOR }}>{pr.est1RM}</div>
                  <div className="text-[9px] text-white/35 uppercase tracking-widest">est 1RM</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Calculator modal */}
      <OneRMCalculator isOpen={showCalc} onClose={() => setShowCalc(false)} />

      {/* Plate calculator modal */}
      <PlateCalculator
        isOpen={!!showPlates}
        prefill={typeof showPlates === 'object' ? showPlates.weight : null}
        onClose={() => setShowPlates(false)}
      />

      {/* Custom workout builder modal */}
      <WorkoutBuilder
        isOpen={showBuilder}
        editing={editingCustom}
        onClose={() => setShowBuilder(false)}
        onSave={async (doc) => {
          if (editingCustom?.id) {
            updateCustom(editingCustom.id, doc)
            if (activeCustom?.id === editingCustom.id) setActiveCustom({ ...editingCustom, ...doc })
          } else {
            const saved = await addCustom(doc)
            if (saved) setActiveCustom(saved)
            setSource('custom')
          }
          setShowBuilder(false)
        }}
      />

      {/* Exercise history modal */}
      <Modal isOpen={!!historyFor} onClose={() => setHistoryFor(null)} title={historyFor || 'History'} accentColor={COLOR}>
        {historyFor && <ExerciseHistoryView name={historyFor} history={sessions} />}
      </Modal>
    </div>
  )
}

/* ---------------- Exercise card ---------------- */

function ExerciseCard({
  ex, exIdx, history, canLinkNext, linked, onToggleTip, onSwap, onUpdateSet, onToggleDone,
  onAddSet, onRemoveSet, onWarmup, onSuperset, onRest, onHistory, onPlates,
}) {
  const swappable = (ex.base.alternatives || []).length > 0
  const ref = ex.lastSets ? bestSet(ex.lastSets) : null
  const repLabel = ex.isTime ? 'sec' : 'reps'
  const isCompound = ex.type === 'compound'
  const workRef = ex.sets.find((s) => !s.warmup && Number(s.weight) > 0)

  return (
    <Card accentColor={COLOR} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-black text-white truncate">{ex.name}</div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {ex.muscle} · {ex.repRange?.[0]}–{ex.repRange?.[1]} {repLabel} · {ex.sets.filter((s) => !s.warmup).length} sets
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {ex.tip && <IconBtn title="How to" onClick={onToggleTip}>{ex.tipOpen ? '✕' : '?'}</IconBtn>}
          {swappable && <IconBtn title="Swap exercise" onClick={onSwap}>⇄</IconBtn>}
          <IconBtn title="History" onClick={onHistory}>📊</IconBtn>
        </div>
      </div>

      {/* Tip */}
      {ex.tipOpen && (
        <div className="mt-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 animate-slideUp">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: COLOR }}>
            Gym Monster 2 setup
          </div>
          <p className="text-xs text-white/65 leading-relaxed">{ex.tip}</p>
        </div>
      )}

      {/* Last session reference */}
      {ref && (
        <div className="mt-2 text-[11px] text-white/35">
          Last: {ref.weight || 'BW'}{ref.weight ? 'kg' : ''} × {ref.reps}{' '}
          {ex.lastSets.length > 1 ? `(${ex.lastSets.length} sets)` : ''}
        </div>
      )}

      {/* Sets */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 px-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">
          <span className="w-6">Set</span>
          <span className="flex-1 text-center">{ex.isTime ? '—' : 'kg'}</span>
          <span className="flex-1 text-center">{ex.isTime ? 'Seconds' : 'Reps'}</span>
          <span className="w-9 text-center">✓</span>
          <span className="w-6" />
        </div>
        {ex.sets.map((s, setIdx) => {
          const pr =
            !s.warmup && s.done && isPR(ex.name, Number(s.weight) || 0, Number(s.reps) || 0, history, true)
          return (
            <div key={setIdx} className="relative flex items-center gap-2" style={s.warmup ? { opacity: 0.85 } : undefined}>
              <span
                className="w-6 text-center text-[11px] font-black"
                style={{ color: s.warmup ? '#F59E0B' : 'rgba(255,255,255,0.5)' }}
                title={s.warmup ? 'Warmup set (excluded from volume/PRs)' : undefined}
              >
                {s.warmup ? 'W' : setIdx + 1}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={s.weight}
                disabled={ex.isTime}
                onChange={(e) => onUpdateSet(exIdx, setIdx, 'weight', e.target.value)}
                placeholder={ex.isTime ? '—' : '0'}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-center text-sm focus:border-[#7C3AED] transition-colors disabled:opacity-30"
              />
              <input
                type="number"
                inputMode="numeric"
                value={s.reps}
                onChange={(e) => onUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-center text-sm focus:border-[#7C3AED] transition-colors"
              />
              <button
                onClick={() => onToggleDone(exIdx, setIdx)}
                title="Mark set done"
                className="btn-press w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: s.done ? COLOR : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${s.done ? COLOR : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <span className={s.done ? 'animate-checkmark text-white text-sm font-black' : 'text-white/30 text-sm'}>✓</span>
              </button>
              <button
                onClick={() => onRemoveSet(exIdx, setIdx)}
                className="w-6 text-white/15 hover:text-red-400 transition-colors flex-shrink-0 text-center"
                title="Remove set"
              >
                ✕
              </button>
              {pr && (
                <span className="absolute -mt-8 ml-8 text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: COLOR, color: '#fff' }}>
                  PR
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onAddSet}
          className="btn-press flex-1 py-2 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-white/60"
        >
          + Add set
        </button>
        <button
          onClick={onRest}
          className="btn-press flex-1 py-2 rounded-lg text-xs font-bold text-white"
          style={{ background: `${COLOR}25`, border: `1px solid ${COLOR}55`, color: COLOR }}
        >
          ⏱ Rest {restSeconds(ex.type)}s
        </button>
      </div>

      {/* Warmup / superset / plate helpers */}
      <div className="flex flex-wrap gap-2 mt-2">
        {isCompound && !ex.isTime && (
          <button
            onClick={onWarmup}
            disabled={!workRef}
            className="btn-press py-1.5 px-3 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/60 disabled:opacity-30"
            title="Add warmup sets based on your working weight"
          >
            🔥 Warmup
          </button>
        )}
        {!ex.isTime && (
          <button
            onClick={() => onPlates(Number(workRef?.weight) || null)}
            className="btn-press py-1.5 px-3 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/60"
            title="Plate calculator"
          >
            🏋️ Plates
          </button>
        )}
        {canLinkNext && (
          <button
            onClick={onSuperset}
            className="btn-press py-1.5 px-3 rounded-lg text-[11px] font-bold"
            style={
              linked
                ? { background: `${COLOR}25`, border: `1px solid ${COLOR}55`, color: COLOR }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
            }
            title="Superset with the next exercise"
          >
            ⛓ {linked ? 'Supersetted' : 'Superset next'}
          </button>
        )}
      </div>
    </Card>
  )
}

function IconBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="btn-press w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white/60 bg-white/5 border border-white/10"
    >
      {children}
    </button>
  )
}

function SummaryStat({ label, value }) {
  return (
    <div className="text-center glass-card py-3 rounded-xl">
      <div className="text-xl font-black" style={{ color: COLOR }}>{value}</div>
      <div className="text-[9px] text-white/35 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  )
}

/* ---------------- Exercise history view ---------------- */

function ExerciseHistoryView({ name, history }) {
  const rows = exerciseHistory(name, history)
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-white/30">
        <div className="text-4xl mb-2">📊</div>
        <p className="text-sm font-semibold">No history yet for this lift.</p>
      </div>
    )
  }
  // Series ascending by date for charts.
  const asc = [...rows].reverse()
  const oneRMSeries = asc.map((row) => {
    const best = bestSet(row.sets)
    return { label: (row.date || '').slice(5).replace('-', '/'), value: epley1RM(best?.weight, best?.reps) }
  })
  const volumeSeries = asc.map((row) => {
    const vol = (row.sets || []).reduce((a, s) => a + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
    return { label: (row.date || '').slice(5).replace('-', '/'), value: Math.round(vol) }
  })
  const hasChart = oneRMSeries.some((p) => p.value > 0)

  return (
    <div className="space-y-2">
      {hasChart && (
        <div className="space-y-3 mb-2">
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Estimated 1RM</div>
            <LineChart data={oneRMSeries} color={COLOR} height={120} yLabel="kg" />
          </div>
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Volume / session</div>
            <BarChart data={volumeSeries} color={COLOR} height={120} />
          </div>
        </div>
      )}
      {rows.map((row, i) => {
        const best = bestSet(row.sets)
        return (
          <div key={i} className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white/50">{row.date}</span>
              <span className="text-[11px] font-bold" style={{ color: COLOR }}>
                best {epley1RM(best?.weight, best?.reps)} est 1RM
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {row.sets.map((s, j) => (
                <span key={j} className="text-[11px] font-semibold text-white/70 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                  {s.weight || 'BW'}{s.weight ? '' : ''} × {s.reps}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- 1RM & working-weight calculator ---------------- */

function OneRMCalculator({ isOpen, onClose }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const oneRM = epley1RM(Number(weight), Number(reps))
  const table = workingWeights(oneRM)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="1RM Calculator" accentColor={COLOR}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Weight (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="60"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Reps</label>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="8"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]"
            />
          </div>
        </div>

        <div className="text-center p-4 rounded-xl" style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}40` }}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">Estimated 1RM</div>
          <div className="text-4xl font-black mt-1" style={{ color: COLOR }}>{oneRM || '—'}<span className="text-lg">kg</span></div>
          <div className="text-[10px] text-white/30 mt-1">Epley formula</div>
        </div>

        {oneRM > 0 && (
          <div>
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Working weights</div>
            <div className="space-y-1.5">
              {table.map((row) => (
                <div key={row.pct} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <span className="w-10 text-sm font-black" style={{ color: COLOR }}>{row.pct}%</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{row.weight}kg</div>
                    <div className="text-[10px] text-white/35">{row.label} · {row.reps} reps</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ---------------- Custom workout picker ---------------- */

function CustomPicker({ workouts, active, onStart, onClear, onEdit, onDelete, onNew }) {
  if (active) {
    return (
      <Card accentColor={COLOR} className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Training custom</div>
            <div className="text-sm font-black text-white truncate">⭐ {active.name}</div>
          </div>
          <button
            onClick={onClear}
            className="btn-press flex-shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/60"
          >
            Change
          </button>
        </div>
      </Card>
    )
  }
  const list = workouts || []
  return (
    <Card accentColor={COLOR} className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Your custom workouts</div>
        <button
          onClick={onNew}
          className="btn-press py-1 px-2.5 rounded-lg text-[11px] font-bold text-white"
          style={{ background: COLOR }}
        >
          ＋ New
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-white/40 py-2">No custom workouts yet. Build one to get started.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((w) => (
            <div key={w.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <button onClick={() => onStart(w)} className="btn-press flex-1 min-w-0 text-left">
                <div className="text-sm font-bold text-white/85 truncate">{w.name}</div>
                <div className="text-[11px] text-white/40">{(w.exercises || []).length} exercises</div>
              </button>
              <button onClick={() => onStart(w)} className="btn-press flex-shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-bold text-white" style={{ background: COLOR }}>Start</button>
              <IconBtn title="Edit" onClick={() => onEdit(w)}>✎</IconBtn>
              <IconBtn title="Delete" onClick={() => onDelete(w)}>🗑</IconBtn>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ---------------- Custom workout builder ---------------- */

function WorkoutBuilder({ isOpen, editing, onClose, onSave }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState([])
  const [picker, setPicker] = useState('') // selected ALL_EXERCISES name
  const [customName, setCustomName] = useState('')
  const [customMuscle, setCustomMuscle] = useState('')
  const [customType, setCustomType] = useState('compound')

  useEffect(() => {
    if (!isOpen) return
    if (editing) {
      setName(editing.name || '')
      setItems((editing.exercises || []).map((e) => ({
        name: e.name,
        muscle: e.muscle || '',
        type: e.type || 'compound',
        repRange: e.repRange || [8, 12],
        sets: e.sets || 3,
      })))
    } else {
      setName('')
      setItems([])
    }
    setPicker('')
    setCustomName('')
    setCustomMuscle('')
    setCustomType('compound')
  }, [isOpen, editing])

  function addFromPicker() {
    const found = ALL_EXERCISES.find((e) => e.name === picker)
    if (!found) return
    setItems((prev) => [...prev, { ...found, repRange: [...found.repRange], sets: 3 }])
    setPicker('')
  }
  function addCustomExercise() {
    const nm = customName.trim()
    if (!nm) return
    setItems((prev) => [...prev, {
      name: nm,
      muscle: customMuscle.trim() || 'Custom',
      type: customType,
      repRange: [8, 12],
      sets: 3,
    }])
    setCustomName('')
    setCustomMuscle('')
  }
  function updateItem(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function move(idx, dir) {
    setItems((prev) => {
      const j = idx + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }
  function remove(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  function save() {
    const nm = name.trim()
    if (!nm || items.length === 0) return
    onSave({
      name: nm,
      exercises: items.map((it) => ({
        name: it.name,
        muscle: it.muscle || '',
        type: it.type || 'compound',
        repRange: [Number(it.repRange?.[0]) || 8, Number(it.repRange?.[1]) || 12],
        sets: Number(it.sets) || 3,
      })),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Workout' : 'Build Workout'} accentColor={COLOR}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Workout name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chest & Triceps blast"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]"
          />
        </div>

        {/* Exercise list */}
        <div className="space-y-2">
          {items.length === 0 && <p className="text-xs text-white/30">Add exercises below.</p>}
          {items.map((it, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white/85 truncate">{it.name}</div>
                  <div className="text-[10px] text-white/40">{it.muscle} · {it.type}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <IconBtn title="Up" onClick={() => move(idx, -1)}>↑</IconBtn>
                  <IconBtn title="Down" onClick={() => move(idx, 1)}>↓</IconBtn>
                  <IconBtn title="Remove" onClick={() => remove(idx)}>✕</IconBtn>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest">Sets</label>
                <input
                  type="number" inputMode="numeric" value={it.sets}
                  onChange={(e) => updateItem(idx, { sets: e.target.value })}
                  className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-center text-sm focus:border-[#7C3AED]"
                />
                <label className="text-[10px] text-white/40 uppercase tracking-widest ml-1">Reps</label>
                <input
                  type="number" inputMode="numeric" value={it.repRange?.[0] ?? ''}
                  onChange={(e) => updateItem(idx, { repRange: [e.target.value, it.repRange?.[1] ?? ''] })}
                  className="w-12 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-center text-sm focus:border-[#7C3AED]"
                />
                <span className="text-white/30">–</span>
                <input
                  type="number" inputMode="numeric" value={it.repRange?.[1] ?? ''}
                  onChange={(e) => updateItem(idx, { repRange: [it.repRange?.[0] ?? '', e.target.value] })}
                  className="w-12 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-center text-sm focus:border-[#7C3AED]"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add from library */}
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Add from library</div>
          <div className="flex gap-2">
            <select
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:border-[#7C3AED]"
            >
              <option value="">Choose exercise…</option>
              {ALL_EXERCISES.map((e) => (
                <option key={e.name} value={e.name}>{e.name} ({e.muscle})</option>
              ))}
            </select>
            <button onClick={addFromPicker} disabled={!picker} className="btn-press py-2 px-3 rounded-lg text-xs font-bold text-white disabled:opacity-30" style={{ background: COLOR }}>Add</button>
          </div>
        </div>

        {/* Add custom exercise */}
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Add custom exercise</div>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Exercise name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#7C3AED]"
          />
          <div className="flex gap-2">
            <input
              value={customMuscle}
              onChange={(e) => setCustomMuscle(e.target.value)}
              placeholder="Muscle"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#7C3AED]"
            />
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:border-[#7C3AED]"
            >
              <option value="compound">Compound</option>
              <option value="isolation">Isolation</option>
            </select>
            <button onClick={addCustomExercise} disabled={!customName.trim()} className="btn-press py-2 px-3 rounded-lg text-xs font-bold text-white disabled:opacity-30" style={{ background: COLOR }}>Add</button>
          </div>
        </div>

        <button
          onClick={save}
          disabled={!name.trim() || items.length === 0}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-30"
          style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}
        >
          {editing ? 'Save Changes' : 'Create Workout'}
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- Plate / loading calculator ---------------- */

function PlateCalculator({ isOpen, prefill, onClose }) {
  const [target, setTarget] = useState('')
  const [bar, setBar] = useState('20')
  const [oneRMWeight, setOneRMWeight] = useState('')
  const [oneRMReps, setOneRMReps] = useState('')

  useEffect(() => {
    if (isOpen && prefill != null && prefill > 0) setTarget(String(prefill))
  }, [isOpen, prefill])

  const bd = plateBreakdown(Number(target), Number(bar) || 0, KG_PLATES)
  const oneRM = epley1RM(Number(oneRMWeight), Number(oneRMReps))
  const pctTable = workingWeights(oneRM)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Plate Calculator" accentColor={COLOR}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Target (kg)</label>
            <input
              type="number" inputMode="decimal" value={target}
              onChange={(e) => setTarget(e.target.value)} placeholder="100"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Bar (kg)</label>
            <input
              type="number" inputMode="decimal" value={bar}
              onChange={(e) => setBar(e.target.value)} placeholder="20"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl" style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}40` }}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Per side</div>
          {bd.perSide.length === 0 ? (
            <div className="text-sm text-white/50">
              {Number(target) > 0 ? 'Just the bar (or below bar weight).' : 'Enter a target weight.'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bd.perSide.map((p, i) => (
                <span key={i} className="text-sm font-black px-2.5 py-1.5 rounded-lg text-white" style={{ background: COLOR }}>
                  {p.count} × {p.plate}kg
                </span>
              ))}
            </div>
          )}
          <div className="text-[11px] text-white/40 mt-2">
            Loads to {bd.loadedTotal}kg{bd.leftover > 0 ? ` · ${bd.leftover}kg short (no plate fits)` : ''}
          </div>
        </div>

        {/* %1RM helper */}
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">%1RM helper</div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number" inputMode="decimal" value={oneRMWeight}
              onChange={(e) => setOneRMWeight(e.target.value)} placeholder="Weight kg"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#7C3AED]"
            />
            <input
              type="number" inputMode="numeric" value={oneRMReps}
              onChange={(e) => setOneRMReps(e.target.value)} placeholder="Reps"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#7C3AED]"
            />
          </div>
          {oneRM > 0 && (
            <>
              <div className="text-[11px] text-white/50">Est 1RM <span className="font-black" style={{ color: COLOR }}>{oneRM}kg</span> — tap a % to load it:</div>
              <div className="flex flex-wrap gap-1.5">
                {pctTable.map((row) => (
                  <button
                    key={row.pct}
                    onClick={() => setTarget(String(row.weight))}
                    className="btn-press px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/70"
                  >
                    {row.pct}% · {row.weight}kg
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
