import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import Card from '../Card'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import RestTimer from './RestTimer'
import {
  SPLIT,
  WORKOUTS,
  BODYWEIGHT,
  DAY_ORDER,
  DAY_LABELS,
  restSeconds,
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
      type: ex.type,
      repRange: ex.repRange,
      isTime: !!ex.isTime,
      tip: ex.tip,
      tipOpen: false,
      lastSets: last,
      sets,
    }
  })
}

export default function TrainTab() {
  const { docs: sessions, loading, fetchDocs, addDocument } = useFirestore('workoutSessions')

  const [selectedDay, setSelectedDay] = useState(todayDayKey())
  const [noGym, setNoGym] = useState(false)
  const [session, setSession] = useState([])
  const [startedAt, setStartedAt] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())

  const [rest, setRest] = useState(null) // { seconds }
  const [summary, setSummary] = useState(null)
  const [showPR, setShowPR] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [historyFor, setHistoryFor] = useState(null) // exercise name

  const readyRef = useRef(false)
  const sessionsRef = useRef([])
  sessionsRef.current = sessions

  useEffect(() => { fetchDocs() }, [fetchDocs])

  // Flip ready once history has loaded the first time.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!loading && !readyRef.current) {
      readyRef.current = true
      setReady(true)
    }
  }, [loading])

  const isRestDay = SPLIT[selectedDay] === 'Rest' && !noGym
  const workoutName = noGym ? 'Bodyweight' : SPLIT[selectedDay]

  // (Re)build the session when the day, gym mode, or first-load status changes.
  useEffect(() => {
    if (noGym) {
      setSession(buildSession(BODYWEIGHT, sessionsRef.current))
    } else if (SPLIT[selectedDay] === 'Rest') {
      setSession([])
    } else {
      setSession(buildSession(WORKOUTS[SPLIT[selectedDay]], sessionsRef.current))
    }
    setStartedAt(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, noGym, ready])

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
        sets: ex.sets
          .filter((s) => String(s.weight) !== '' || String(s.reps) !== '' || s.done)
          .map((s) => ({
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
            done: !!s.done,
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
      day: selectedDay,
      mode: noGym ? 'bodyweight' : 'gym',
      exercises,
      durationMin,
      volume,
      prs,
    }
    addDocument(doc)
    setSummary({ ...doc, totalSets })
    setStartedAt(null)
    // Reset the working session to a fresh copy for the same day.
    if (noGym) setSession(buildSession(BODYWEIGHT, [doc, ...history]))
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
        sets: ex.sets.map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
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
          const active = d === selectedDay && !noGym
          const isToday = d === todayDayKey()
          const restDay = SPLIT[d] === 'Rest'
          return (
            <button
              key={d}
              onClick={() => { setNoGym(false); setSelectedDay(d) }}
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

      {/* Mode + tools row */}
      <div className="flex gap-2">
        <button
          onClick={() => setNoGym((v) => !v)}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: noGym ? COLOR : 'rgba(255,255,255,0.05)',
            color: noGym ? '#fff' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${noGym ? COLOR : 'rgba(255,255,255,0.1)'}`,
            boxShadow: noGym ? `0 0 16px ${COLOR}55` : 'none',
          }}
        >
          🏠 No gym
        </button>
        <button
          onClick={() => setShowPR(true)}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white/70"
        >
          🏆 PRs
        </button>
        <button
          onClick={() => setShowCalc(true)}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white/70"
        >
          🧮 1RM
        </button>
      </div>

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
              onClick={() => setNoGym(true)}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: COLOR, boxShadow: `0 0 18px ${COLOR}55` }}
            >
              Bodyweight session
            </button>
            <button
              onClick={() => setSelectedDay('Mon')}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white/70"
            >
              Pick a workout
            </button>
          </div>
        </Card>
      ) : (
        <>
          {/* Session header */}
          <Card accentColor={COLOR} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                  {noGym ? 'Home workout' : DAY_LABELS[selectedDay]}
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
          {session.map((ex, exIdx) => (
            <ExerciseCard
              key={exIdx}
              ex={ex}
              exIdx={exIdx}
              history={sessions}
              onToggleTip={() => toggleTip(exIdx)}
              onSwap={() => swapExercise(exIdx)}
              onUpdateSet={updateSet}
              onToggleDone={toggleDone}
              onAddSet={() => addSet(exIdx)}
              onRemoveSet={removeSet}
              onRest={() => setRest({ seconds: restSeconds(ex.type) })}
              onHistory={() => setHistoryFor(ex.name)}
            />
          ))}
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
                  {s.mode === 'bodyweight' ? '🏠' : '🏋️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85">
                    {s.mode === 'bodyweight' ? 'Bodyweight' : SPLIT[s.day] || s.day || 'Workout'}
                    {s.prs?.length ? <span className="ml-2 text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: COLOR, color: '#fff' }}>{s.prs.length} PR</span> : null}
                  </div>
                  <div className="text-[11px] text-white/40">
                    {s.date} · {s.durationMin || 0}min · {s.volume || 0}kg
                  </div>
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
              <div className="text-lg font-black text-white">{summary.mode === 'bodyweight' ? 'Bodyweight' : SPLIT[summary.day] || summary.day}</div>
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
                    {ex.sets.length} × {ex.sets.map((s) => `${s.weight || 'BW'}×${s.reps}`).join(', ')}
                  </span>
                </div>
              ))}
            </div>
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

      {/* Exercise history modal */}
      <Modal isOpen={!!historyFor} onClose={() => setHistoryFor(null)} title={historyFor || 'History'} accentColor={COLOR}>
        {historyFor && <ExerciseHistoryView name={historyFor} history={sessions} />}
      </Modal>
    </div>
  )
}

/* ---------------- Exercise card ---------------- */

function ExerciseCard({
  ex, exIdx, history, onToggleTip, onSwap, onUpdateSet, onToggleDone,
  onAddSet, onRemoveSet, onRest, onHistory,
}) {
  const swappable = (ex.base.alternatives || []).length > 0
  const ref = ex.lastSets ? bestSet(ex.lastSets) : null
  const repLabel = ex.isTime ? 'sec' : 'reps'

  return (
    <Card accentColor={COLOR} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-black text-white truncate">{ex.name}</div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {ex.muscle} · {ex.repRange?.[0]}–{ex.repRange?.[1]} {repLabel} · {ex.sets.length} sets
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <IconBtn title="How to" onClick={onToggleTip}>{ex.tipOpen ? '✕' : '?'}</IconBtn>
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
            s.done && isPR(ex.name, Number(s.weight) || 0, Number(s.reps) || 0, history, true)
          return (
            <div key={setIdx} className="relative flex items-center gap-2">
              <span className="w-6 text-center text-sm font-bold text-white/50">{setIdx + 1}</span>
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
  return (
    <div className="space-y-2">
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
