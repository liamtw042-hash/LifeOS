import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#F97316'

const WORKOUT_TYPES = ['Run', 'Lift', 'Yoga', 'Swim', 'Bike', 'HIIT', 'Walk', 'Other']

export default function Fitness() {
  const workouts = useFirestore('workouts')
  const weights = useFirestore('weights')
  const [showWorkoutModal, setShowWorkoutModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [form, setForm] = useState({ type: 'Run', duration: '', date: new Date().toISOString().slice(0, 10), notes: '' })
  const [weightForm, setWeightForm] = useState({ value: '', date: new Date().toISOString().slice(0, 10) })

  useEffect(() => {
    workouts.fetchDocs()
    weights.fetchDocs()
  }, [])

  async function saveWorkout(e) {
    e.preventDefault()
    if (!form.duration) return
    await workouts.addDocument({ ...form, duration: Number(form.duration) })
    setShowWorkoutModal(false)
    setForm({ type: 'Run', duration: '', date: new Date().toISOString().slice(0, 10), notes: '' })
  }

  async function saveWeight(e) {
    e.preventDefault()
    if (!weightForm.value) return
    await weights.addDocument({ value: Number(weightForm.value), date: weightForm.date })
    setShowWeightModal(false)
    setWeightForm({ value: '', date: new Date().toISOString().slice(0, 10) })
  }

  const sortedWorkouts = [...workouts.docs].sort((a, b) => b.date?.localeCompare(a.date))
  const sortedWeights = [...weights.docs].sort((a, b) => b.date?.localeCompare(a.date))
  const lastWeights = sortedWeights.slice(0, 5).reverse()

  function typeEmoji(type) {
    const map = { Run: '🏃', Lift: '🏋️', Yoga: '🧘', Swim: '🏊', Bike: '🚴', HIIT: '⚡', Walk: '🚶', Other: '💪' }
    return map[type] || '💪'
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Fitness</h1>
          <p className="text-sm text-white/40 mt-0.5">{sortedWorkouts.length} workouts logged</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWeightModal(true)}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white/70 border border-white/10 hover:border-white/20 transition-all"
          >
            ⚖️ Weight
          </button>
          <button
            onClick={() => setShowWorkoutModal(true)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}40` }}
          >
            + Log
          </button>
        </div>
      </div>

      {/* Weight Trend */}
      {lastWeights.length > 0 && (
        <Card color={COLOR}>
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-3">Weight Trend</h2>
          <div className="flex items-end gap-3">
            {lastWeights.map((w, i) => (
              <div key={w.id} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs text-white/50">{w.value}kg</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${40 + (w.value - Math.min(...lastWeights.map(x => x.value))) * 8}px`,
                    background: i === lastWeights.length - 1 ? COLOR : `${COLOR}40`,
                  }}
                />
                <span className="text-xs text-white/30">{w.date?.slice(5)}</span>
              </div>
            ))}
          </div>
          {lastWeights.length >= 2 && (
            <p className="text-xs text-white/40 mt-3">
              {(() => {
                const diff = (lastWeights[lastWeights.length - 1].value - lastWeights[0].value).toFixed(1)
                return diff > 0 ? `+${diff}kg since first entry` : `${diff}kg since first entry`
              })()}
            </p>
          )}
        </Card>
      )}

      {/* Recent Workouts */}
      {workouts.loading ? (
        <LoadingSpinner color={COLOR} />
      ) : sortedWorkouts.length === 0 ? (
        <Card color={COLOR}>
          <div className="text-center py-8 text-white/30">
            <div className="text-4xl mb-3">💪</div>
            <p className="text-sm">No workouts yet. Log your first one!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedWorkouts.map((w) => (
            <Card key={w.id} color={COLOR}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${COLOR}20` }}
                  >
                    {typeEmoji(w.type)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{w.type}</p>
                    <p className="text-xs text-white/40 mt-0.5">{w.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white" style={{ color: COLOR }}>{w.duration}min</p>
                  {w.notes && <p className="text-xs text-white/40 mt-0.5 max-w-[120px] text-right">{w.notes}</p>}
                </div>
              </div>
              <button
                onClick={() => workouts.deleteDocument(w.id)}
                className="mt-3 text-xs text-white/20 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Log Workout Modal */}
      <Modal open={showWorkoutModal} onClose={() => setShowWorkoutModal(false)} title="Log Workout" color={COLOR}>
        <form onSubmit={saveWorkout} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Type</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {WORKOUT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className="py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: form.type === t ? COLOR : 'rgba(255,255,255,0.05)',
                    color: form.type === t ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {typeEmoji(t)} {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Duration (minutes)</label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              placeholder="45"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Felt great today..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{ background: COLOR }}
          >
            Log Workout
          </button>
        </form>
      </Modal>

      {/* Log Weight Modal */}
      <Modal open={showWeightModal} onClose={() => setShowWeightModal(false)} title="Log Weight" color={COLOR}>
        <form onSubmit={saveWeight} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightForm.value}
              onChange={(e) => setWeightForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="75.0"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest">Date</label>
            <input
              type="date"
              value={weightForm.date}
              onChange={(e) => setWeightForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{ background: COLOR }}
          >
            Save Weight
          </button>
        </form>
      </Modal>
    </div>
  )
}
