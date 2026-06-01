import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#F97316'

const WORKOUT_TYPES = [
  { label: 'Run', icon: '🏃' },
  { label: 'Lift', icon: '🏋️' },
  { label: 'Yoga', icon: '🧘' },
  { label: 'Swim', icon: '🏊' },
  { label: 'Bike', icon: '🚴' },
  { label: 'HIIT', icon: '⚡' },
  { label: 'Walk', icon: '🚶' },
  { label: 'Other', icon: '💪' },
]

export default function Fitness() {
  const { docs: workouts, loading: lW, fetchDocs: fetchWorkouts, addDocument: addWorkout, deleteDocument: delWorkout } = useFirestore('workouts')
  const { docs: weightLogs, loading: lWt, fetchDocs: fetchWeights, addDocument: addWeight, deleteDocument: delWeight } = useFirestore('weights')
  const [showWorkoutModal, setShowWorkoutModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [wForm, setWForm] = useState({ type: 'Run', duration: '', date: new Date().toISOString().slice(0, 10), notes: '' })
  const [wtForm, setWtForm] = useState({ value: '', date: new Date().toISOString().slice(0, 10) })

  useEffect(() => { fetchWorkouts(); fetchWeights() }, [fetchWorkouts, fetchWeights])

  async function handleAddWorkout(e) {
    e.preventDefault()
    if (!wForm.duration) return
    await addWorkout({ ...wForm, duration: Number(wForm.duration) })
    setWForm({ type: 'Run', duration: '', date: new Date().toISOString().slice(0, 10), notes: '' })
    setShowWorkoutModal(false)
  }

  async function handleAddWeight(e) {
    e.preventDefault()
    if (!wtForm.value) return
    await addWeight({ value: Number(wtForm.value), date: wtForm.date })
    setWtForm({ value: '', date: new Date().toISOString().slice(0, 10) })
    setShowWeightModal(false)
  }

  const sortedWorkouts = [...workouts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const sortedWeights = [...weightLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const last5 = sortedWeights.slice(-5)
  const loading = lW || lWt

  const typeIcon = (t) => WORKOUT_TYPES.find(x => x.label === t)?.icon || '💪'
  const totalMins = workouts.reduce((s, w) => s + (Number(w.duration) || 0), 0)

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Fitness</h1>
          <p className="text-white/40 text-sm mt-1">{workouts.length} workouts · {totalMins}min total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowWeightModal(true)}
            className="btn-press h-10 px-3 rounded-full text-sm font-bold border transition-colors"
            style={{ borderColor: `${COLOR}40`, color: COLOR }}>
            ⚖️
          </button>
          <button onClick={() => setShowWorkoutModal(true)}
            className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>+</button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner color={COLOR} size={32} /></div>}

      {/* Weight trend */}
      {last5.length > 0 && (
        <Card accentColor={COLOR} className="mb-5 p-4">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Weight Trend</div>
          <div className="flex items-end gap-2 h-16">
            {last5.map((w, i) => {
              const vals = last5.map(x => x.value)
              const min = Math.min(...vals)
              const max = Math.max(...vals)
              const range = max - min || 1
              const pct = ((w.value - min) / range) * 60 + 16
              const isLast = i === last5.length - 1
              return (
                <div key={w.id} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[9px] text-white/40">{w.value}kg</span>
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{ height: `${pct}px`, background: isLast ? COLOR : `${COLOR}40`, boxShadow: isLast ? `0 0 8px ${COLOR}80` : 'none' }} />
                  <span className="text-[9px] text-white/25">{w.date?.slice(5)}</span>
                </div>
              )
            })}
          </div>
          {last5.length >= 2 && (() => {
            const diff = (last5[last5.length - 1].value - last5[0].value).toFixed(1)
            return (
              <p className="text-xs mt-2" style={{ color: Number(diff) <= 0 ? '#10B981' : '#EF4444' }}>
                {Number(diff) > 0 ? `+${diff}` : diff}kg over last {last5.length} entries
              </p>
            )
          })()}
        </Card>
      )}

      {/* Workout list */}
      <div className="space-y-3">
        {sortedWorkouts.map(w => (
          <Card key={w.id} accentColor={COLOR} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${COLOR}18` }}>
                {typeIcon(w.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{w.type}</span>
                  <span className="font-black text-sm" style={{ color: COLOR }}>{w.duration}min</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-white/30">{w.date}</span>
                  {w.notes && <span className="text-xs text-white/40 truncate max-w-[120px]">· {w.notes}</span>}
                </div>
              </div>
              <button onClick={() => delWorkout(w.id)} className="text-white/15 hover:text-red-400 transition-colors ml-1 flex-shrink-0">✕</button>
            </div>
          </Card>
        ))}
        {!loading && workouts.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-3">💪</div>
            <p className="font-semibold">Log your first workout</p>
          </div>
        )}
      </div>

      {/* Log Workout Modal */}
      <Modal isOpen={showWorkoutModal} onClose={() => setShowWorkoutModal(false)} title="Log Workout" accentColor={COLOR}>
        <form onSubmit={handleAddWorkout} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-widest">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {WORKOUT_TYPES.map(t => (
                <button key={t.label} type="button"
                  onClick={() => setWForm(f => ({ ...f, type: t.label }))}
                  className="btn-press flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: wForm.type === t.label ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                    color: wForm.type === t.label ? COLOR : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${wForm.type === t.label ? COLOR + '60' : 'transparent'}`,
                  }}>
                  <span className="text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Duration (minutes)</label>
            <input type="number" min="1" value={wForm.duration} onChange={e => setWForm(f => ({ ...f, duration: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#F97316] transition-colors"
              placeholder="45" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={wForm.date} onChange={e => setWForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#F97316] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Notes</label>
            <input type="text" value={wForm.notes} onChange={e => setWForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#F97316] transition-colors"
              placeholder="How did it feel?" />
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #EA580C)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Log Workout
          </button>
        </form>
      </Modal>

      {/* Log Weight Modal */}
      <Modal isOpen={showWeightModal} onClose={() => setShowWeightModal(false)} title="Log Weight" accentColor={COLOR}>
        <form onSubmit={handleAddWeight} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Weight (kg)</label>
            <input type="number" step="0.1" value={wtForm.value} onChange={e => setWtForm(f => ({ ...f, value: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#F97316] transition-colors"
              placeholder="75.0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={wtForm.date} onChange={e => setWtForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#F97316] transition-colors" />
          </div>
          <div className="flex gap-2">
            {weightLogs.slice(-3).reverse().map(w => (
              <div key={w.id} className="flex-1 text-center glass-card py-2 rounded-xl">
                <div className="font-black text-sm" style={{ color: COLOR }}>{w.value}kg</div>
                <div className="text-[9px] text-white/30 mt-0.5">{w.date?.slice(5)}</div>
              </div>
            ))}
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #EA580C)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Save Weight
          </button>
        </form>
      </Modal>
    </div>
  )
}
