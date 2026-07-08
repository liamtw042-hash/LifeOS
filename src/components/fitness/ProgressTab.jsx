import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import Card from '../Card'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import { generateCoachInsights } from '../../lib/coach'
import { BarChart, LineChart } from '../charts/Charts'
import { formatWeight, toKg, fromKg } from '../../lib/units'
import { weightProjection, prTimeline } from '../../lib/training'

const COLOR = '#7C3AED'
const TONE = { good: '#10B981', warn: '#F97316', info: '#7C3AED' }
const DEFAULT_TARGETS = { calories: 2200, protein: 150 }
const MEAS_METRICS = [
  { key: 'waist', label: 'Waist', icon: '📏' },
  { key: 'chest', label: 'Chest', icon: '🫁' },
  { key: 'arms', label: 'Arms', icon: '💪' },
  { key: 'hips', label: 'Hips', icon: '🧍' },
  { key: 'thighs', label: 'Thighs', icon: '🦵' },
]

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function lastNDayKeys(n) {
  const out = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    out.push(localKey(d))
  }
  return out
}
const sumField = (items, field) =>
  (items || []).reduce((a, it) => a + (Number(it[field]) || 0), 0)

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(dateStr, today) {
  const a = new Date(String(dateStr) + 'T00:00:00')
  const b = new Date(String(today) + 'T00:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Infinity
  return Math.round((b - a) / 86400000)
}

// Client-side image compression: resize longest side to ~700px, JPEG q~0.7.
function compressImage(file, maxSide = 700, quality = 0.7) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('read failed'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('decode failed'))
        img.onload = () => {
          let { width, height } = img
          if (width >= height && width > maxSide) {
            height = Math.round((height * maxSide) / width)
            width = maxSide
          } else if (height > maxSide) {
            width = Math.round((width * maxSide) / height)
            height = maxSide
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.src = reader.result
      }
      reader.readAsDataURL(file)
    } catch (e) {
      reject(e)
    }
  })
}

export default function ProgressTab() {
  const {
    docs: weightLogs, loading: lWeights, fetchDocs: fetchWeights,
    addDocument: addWeight, deleteDocument: deleteWeight,
  } = useFirestore('weights')
  const { docs: foodLogs, fetchDocs: fetchFood } = useFirestore('foodLog')
  const {
    docs: profiles, fetchDocs: fetchProfile,
    addDocument: addProfile, updateDocument: updateProfile,
  } = useFirestore('fitnessProfile')
  const { docs: settingsDocs, fetchDocs: fetchSettings } = useFirestore('settings')
  const { docs: sessions, fetchDocs: fetchSessions } = useFirestore('workoutSessions')
  const { docs: habits, fetchDocs: fetchHabits } = useFirestore('habits')
  const {
    docs: photos, loading: lPhotos, fetchDocs: fetchPhotos,
    addDocument: addPhoto, deleteDocument: deletePhoto,
  } = useFirestore('progressPhotos')
  const {
    docs: measurements, loading: lMeas, fetchDocs: fetchMeas,
    addDocument: addMeas, deleteDocument: deleteMeas,
  } = useFirestore('measurements')

  const [showWtModal, setShowWtModal] = useState(false)
  const [wtForm, setWtForm] = useState({ value: '', date: todayStr() })
  const [uploading, setUploading] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [picked, setPicked] = useState([]) // photo ids
  const [viewPhoto, setViewPhoto] = useState(null)
  const [nutRange, setNutRange] = useState(7)
  const [showMeasModal, setShowMeasModal] = useState(false)
  const [measForm, setMeasForm] = useState({ date: todayStr(), waist: '', chest: '', arms: '', hips: '', thighs: '' })
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalForm, setGoalForm] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    fetchWeights(); fetchFood(); fetchProfile()
    fetchSessions(); fetchHabits(); fetchPhotos(); fetchMeas(); fetchSettings()
  }, [fetchWeights, fetchFood, fetchProfile, fetchSessions, fetchHabits, fetchPhotos, fetchMeas, fetchSettings])

  const today = todayStr()
  const units = (settingsDocs || [])[0]?.units === 'lb' ? 'lb' : 'kg'
  const fmtWt = (kg) => formatWeight(kg, units)
  const profile = (profiles || [])[0] || null
  const goalWeight = Number(profile?.goalWeight) > 0 ? Number(profile.goalWeight) : null

  // ---- weight data ----
  const sorted = useMemo(
    () => [...(weightLogs || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [weightLogs]
  )
  // Weight nearest to a given date (for photo captions).
  function weightNear(dateStr) {
    if (!sorted.length || !dateStr) return null
    let best = null
    let bestGap = Infinity
    for (const w of sorted) {
      const gap = Math.abs(daysAgo(w.date, dateStr))
      if (gap < bestGap) { bestGap = gap; best = w }
    }
    return best && bestGap <= 10 ? Number(best.value) : null
  }

  // Weekly summary: this week avg vs last week avg + net change.
  const weekly = useMemo(() => {
    const thisWeek = sorted.filter((w) => daysAgo(w.date, today) <= 6 && daysAgo(w.date, today) >= 0)
    const lastWeek = sorted.filter((w) => daysAgo(w.date, today) <= 13 && daysAgo(w.date, today) >= 7)
    const avg = (arr) => arr.length ? arr.reduce((a, w) => a + (Number(w.value) || 0), 0) / arr.length : null
    const tw = avg(thisWeek)
    const lw = avg(lastWeek)
    const net = tw != null && lw != null ? tw - lw : null
    return { tw, lw, net, thisCount: thisWeek.length }
  }, [sorted, today])

  // Line-chart series for bodyweight, values displayed in the user's units.
  const weightSeries = useMemo(
    () => sorted.slice(-30).map((w) => ({
      label: (w.date || '').slice(5).replace('-', '/'),
      value: Number(fromKg(w.value, units).toFixed(1)),
    })),
    [sorted, units]
  )

  // Linear-regression projection toward the goal (all maths in kg).
  const projection = useMemo(
    () => weightProjection(weightLogs || [], goalWeight, 30, new Date()),
    [weightLogs, goalWeight]
  )
  const etaText = useMemo(() => {
    if (!projection.etaDate) return null
    const d = projection.etaDate
    const days = Math.max(0, Math.round((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000))
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return { dateStr, days }
  }, [projection])

  // PR timeline feed (newest first).
  const prFeed = useMemo(() => prTimeline(sessions || []), [sessions])

  // ---- coach ----
  const targets = useMemo(() => {
    const p = (profiles || [])[0]
    return p ? { protein: p.protein, goal: p.goal } : { protein: 0 }
  }, [profiles])
  const todayFoodLog = useMemo(
    () => (foodLogs || []).find((d) => d.date === today) || null,
    [foodLogs, today]
  )
  const insights = useMemo(
    () => generateCoachInsights({
      todayFoodLog, targets, sessions: sessions || [], weights: weightLogs || [], habits: habits || [], today,
    }),
    [todayFoodLog, targets, sessions, weightLogs, habits, today]
  )

  // ---- nutrition trends ----
  const nutTargets = useMemo(() => {
    const p = (profiles || [])[0]
    return {
      calories: (p && p.calories) || DEFAULT_TARGETS.calories,
      protein: (p && p.protein) || DEFAULT_TARGETS.protein,
    }
  }, [profiles])

  const nutrition = useMemo(() => {
    const byDate = {}
    for (const log of foodLogs || []) byDate[log.date] = log
    const keys = lastNDayKeys(nutRange)
    const fmt = (k) => k.slice(5).replace('-', '/')
    const cals = keys.map((k) => ({ label: fmt(k), value: byDate[k] ? Math.round(sumField(byDate[k].items, 'cal')) : 0 }))
    const prot = keys.map((k) => ({ label: fmt(k), value: byDate[k] ? Math.round(sumField(byDate[k].items, 'p')) : 0 }))
    const logged = keys.filter((k) => byDate[k] && (byDate[k].items || []).length).length
    return { cals, prot, logged }
  }, [foodLogs, nutRange])

  // ---- handlers ----
  async function handleAddWeight(e) {
    e.preventDefault()
    if (!wtForm.value) return
    await addWeight({ value: Number(toKg(wtForm.value, units).toFixed(2)), date: wtForm.date })
    setWtForm({ value: '', date: todayStr() })
    setShowWtModal(false)
  }

  async function handleSaveGoal(e) {
    e.preventDefault()
    const kg = Number(toKg(goalForm, units).toFixed(2))
    const payload = { goalWeight: kg > 0 ? kg : null }
    if (profile) await updateProfile(profile.id, payload)
    else await addProfile(payload)
    setShowGoalModal(false)
  }
  function openGoalModal() {
    setGoalForm(goalWeight ? String(Number(fromKg(goalWeight, units).toFixed(1))) : '')
    setShowGoalModal(true)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await compressImage(file)
      await addPhoto({ date: today, dataUrl, note: '' })
    } catch (err) {
      // ignore — never crash the tab
    } finally {
      setUploading(false)
    }
  }

  function togglePick(id) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const sortedPhotos = useMemo(
    () => [...(photos || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [photos]
  )
  const pickedPhotos = picked.map((id) => (photos || []).find((p) => p.id === id)).filter(Boolean)

  // ---- measurements ----
  const sortedMeas = useMemo(
    () => [...(measurements || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [measurements]
  )
  const measByMetric = useMemo(() => {
    const out = {}
    for (const m of MEAS_METRICS) {
      const series = sortedMeas
        .filter((d) => d[m.key] != null && d[m.key] !== '' && Number.isFinite(Number(d[m.key])))
        .map((d) => ({ label: (d.date || '').slice(5).replace('-', '/'), value: Number(d[m.key]) }))
      const latest = series.length ? series[series.length - 1].value : null
      const prev = series.length >= 2 ? series[series.length - 2].value : null
      out[m.key] = { series, latest, change: latest != null && prev != null ? latest - prev : null }
    }
    return out
  }, [sortedMeas])
  const hasAnyMeas = MEAS_METRICS.some((m) => measByMetric[m.key].latest != null)

  async function handleAddMeasurement(e) {
    e.preventDefault()
    const payload = { date: measForm.date }
    let any = false
    for (const m of MEAS_METRICS) {
      const raw = measForm[m.key]
      if (raw !== '' && raw != null && Number.isFinite(Number(raw))) {
        payload[m.key] = Number(raw)
        any = true
      }
    }
    if (!any) return
    await addMeas(payload)
    setMeasForm({ date: todayStr(), waist: '', chest: '', arms: '', hips: '', thighs: '' })
    setShowMeasModal(false)
  }

  return (
    <div className="space-y-5">
      {/* ---- Coach panel ---- */}
      <Card accentColor={COLOR} className="p-4">
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">🧠 Coach</div>
        <div className="space-y-2">
          {insights.map((ins, i) => {
            const c = TONE[ins.tone] || TONE.info
            return (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl animate-slideUp"
                style={{ background: `${c}14`, border: `1px solid ${c}33` }}>
                <span className="text-base leading-none mt-0.5">{ins.icon}</span>
                <span className="text-sm text-white/85 leading-snug">{ins.text}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ---- Weight header + log ---- */}
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{(weightLogs || []).length} weigh-ins</p>
        <div className="flex items-center gap-2">
          <button onClick={openGoalModal}
            className="btn-press h-10 px-3 rounded-full text-sm font-bold flex items-center gap-1"
            style={{ color: COLOR, border: `1px solid ${COLOR}40` }}>🎯 Goal</button>
          <button onClick={() => setShowWtModal(true)}
            className="btn-press h-10 px-4 rounded-full text-sm font-bold text-white flex items-center gap-1"
            style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>⚖️ Log</button>
        </div>
      </div>

      {lWeights && <div className="flex justify-center py-4"><LoadingSpinner color={COLOR} size={26} /></div>}

      {/* ---- Goal + projection ---- */}
      {(goalWeight != null || projection.current != null) && (
        <Card accentColor={COLOR} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">🎯 Bodyweight Goal</div>
            <button onClick={openGoalModal} className="btn-press text-[11px] font-bold" style={{ color: COLOR }}>
              {goalWeight != null ? 'Edit' : 'Set goal'}
            </button>
          </div>
          {goalWeight == null ? (
            <p className="text-sm text-white/35">Set a goal weight to see how far you have to go and an estimated date to reach it.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="text-sm font-black text-white">{projection.current != null ? fmtWt(projection.current) : '–'}</div>
                  <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">Current</div>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="text-sm font-black" style={{ color: COLOR }}>{fmtWt(goalWeight)}</div>
                  <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">Goal</div>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="text-sm font-black text-white">
                    {projection.remaining != null ? fmtWt(Math.abs(projection.remaining)) : '–'}
                  </div>
                  <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">
                    {projection.remaining != null && projection.remaining < 0 ? 'To gain' : 'To lose'}
                  </div>
                </div>
              </div>
              <div className="mt-3 p-2.5 rounded-xl flex items-start gap-2.5"
                style={{ background: `${COLOR}14`, border: `1px solid ${COLOR}33` }}>
                <span className="text-base leading-none mt-0.5">
                  {projection.status === 'reached' ? '🎉' : projection.status === 'projecting' ? '📈' : projection.status === 'flat' ? '➖' : projection.status === 'away' ? '⚠️' : '📊'}
                </span>
                <span className="text-sm text-white/85 leading-snug">
                  {projection.status === 'insufficient' && 'Log at least 2 weigh-ins to project a date.'}
                  {projection.status === 'reached' && 'You have reached your goal weight. Nice work!'}
                  {projection.status === 'flat' && 'Your trend is flat — adjust intake or training to move toward your goal.'}
                  {projection.status === 'away' && 'Your recent trend is moving away from your goal.'}
                  {projection.status === 'projecting' && etaText && (
                    <>On your recent trend you'll hit {fmtWt(goalWeight)} around <span className="font-bold text-white">{etaText.dateStr}</span> (~{etaText.days} days).</>
                  )}
                </span>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ---- Trend chart ---- */}
      {weightSeries.length > 0 && (
        <Card accentColor={COLOR} className="p-4">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Bodyweight Trend · {units}</div>
          <LineChart
            data={weightSeries}
            color={COLOR}
            height={150}
            yLabel={units}
            target={goalWeight != null ? Number(fromKg(goalWeight, units).toFixed(1)) : undefined}
          />

          {/* Weekly summary */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
            <div className="text-center">
              <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">This wk avg</div>
              <div className="text-sm font-black text-white">{weekly.tw != null ? fmtWt(weekly.tw) : '–'}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Last wk avg</div>
              <div className="text-sm font-black text-white">{weekly.lw != null ? fmtWt(weekly.lw) : '–'}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Net</div>
              <div className="text-sm font-black" style={{ color: weekly.net == null ? '#fff' : weekly.net <= 0 ? '#10B981' : '#F97316' }}>
                {weekly.net == null ? '–' : `${weekly.net > 0 ? '+' : ''}${fmtWt(weekly.net)}`}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---- PR timeline feed ---- */}
      <Card accentColor={COLOR} className="p-4">
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">🏆 PR Timeline</div>
        {prFeed.length === 0 ? (
          <div className="text-center py-6 text-white/30">
            <div className="text-3xl mb-1">🏆</div>
            <p className="text-sm font-semibold">No personal records yet</p>
            <p className="text-[11px] mt-1">Beat a lift to log your first PR</p>
          </div>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-1 top-1 bottom-1 w-px bg-white/10" />
            <div className="space-y-3">
              {prFeed.slice(0, 40).map((pr, i) => (
                <div key={`${pr.date}-${pr.name}-${i}`} className="relative">
                  <div className="absolute -left-[13px] top-1.5 w-2.5 h-2.5 rounded-full"
                    style={{ background: COLOR, boxShadow: `0 0 8px ${COLOR}90` }} />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-white truncate">{pr.name}</span>
                    <span className="text-[10px] text-white/35 flex-shrink-0">
                      {pr.date ? new Date(pr.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <div className="text-[12px]" style={{ color: COLOR }}>
                    {pr.weight > 0 || pr.reps > 0 ? (
                      <span className="font-black">{fmtWt(pr.weight)} × {pr.reps}</span>
                    ) : (
                      <span className="font-semibold text-white/40">New PR</span>
                    )}
                    {pr.est1RM > 0 && <span className="text-white/40 font-semibold"> · est {fmtWt(pr.est1RM)} 1RM</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ---- Nutrition trends ---- */}
      <Card accentColor={COLOR} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">🍽 Nutrition Trends</div>
          <div className="flex gap-1">
            {[7, 30].map((n) => (
              <button
                key={n}
                onClick={() => setNutRange(n)}
                className="btn-press text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                style={{
                  color: nutRange === n ? '#fff' : COLOR,
                  background: nutRange === n ? COLOR : 'transparent',
                  border: `1px solid ${COLOR}40`,
                }}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
        {nutrition.logged === 0 ? (
          <div className="text-center py-6 text-white/30">
            <div className="text-3xl mb-1">🍽</div>
            <p className="text-sm font-semibold">No food logged yet</p>
          </div>
        ) : (
          <>
            <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1">Calories / day · target {nutTargets.calories}</div>
            <BarChart data={nutrition.cals} color={COLOR} target={nutTargets.calories} height={130} />
            <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1 mt-3">Protein / day · target {nutTargets.protein}g</div>
            <LineChart data={nutrition.prot} color={COLOR} target={nutTargets.protein} height={130} yLabel="g" />
          </>
        )}
      </Card>

      {/* ---- Body measurements ---- */}
      <Card accentColor={COLOR} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">📐 Measurements</div>
          <button onClick={() => setShowMeasModal(true)}
            className="btn-press text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ color: COLOR, border: `1px solid ${COLOR}40` }}>+ Log</button>
        </div>

        {lMeas && <div className="flex justify-center py-4"><LoadingSpinner color={COLOR} size={22} /></div>}

        {!lMeas && !hasAnyMeas ? (
          <div className="text-center py-6 text-white/30">
            <div className="text-3xl mb-1">📐</div>
            <p className="text-sm font-semibold">No measurements yet</p>
            <p className="text-[11px] mt-1">Track waist, chest, arms & more (cm)</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Latest values with change */}
            <div className="grid grid-cols-3 gap-2">
              {MEAS_METRICS.map((m) => {
                const d = measByMetric[m.key]
                if (d.latest == null) return null
                return (
                  <div key={m.key} className="text-center p-2 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">{m.icon} {m.label}</div>
                    <div className="text-sm font-black text-white">{d.latest}<span className="text-[10px] text-white/40 font-semibold">cm</span></div>
                    {d.change != null && (
                      <div className="text-[10px] font-bold" style={{ color: d.change === 0 ? 'rgba(255,255,255,0.4)' : d.change < 0 ? '#10B981' : '#F97316' }}>
                        {d.change > 0 ? '+' : ''}{d.change.toFixed(1)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Per-metric trend charts */}
            {MEAS_METRICS.map((m) => {
              const d = measByMetric[m.key]
              if (d.series.length < 2) return null
              return (
                <div key={m.key}>
                  <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1">{m.icon} {m.label} · cm</div>
                  <LineChart data={d.series} color={COLOR} height={110} yLabel="cm" />
                </div>
              )
            })}

            {/* Entry log with delete */}
            <div className="space-y-1.5 pt-1">
              {[...(measurements || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((m) => {
                const parts = MEAS_METRICS
                  .filter((mm) => m[mm.key] != null && m[mm.key] !== '')
                  .map((mm) => `${mm.label} ${m[mm.key]}`)
                return (
                  <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white/70">{m.date}</div>
                      <div className="text-[10px] text-white/40 truncate">{parts.join(' · ') || '—'}</div>
                    </div>
                    <button onClick={() => deleteMeas(m.id)} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ---- Progress photos ---- */}
      <Card accentColor={COLOR} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">📸 Progress Photos</div>
          {sortedPhotos.length >= 2 && (
            <button onClick={() => { setCompareMode((v) => !v); setPicked([]) }}
              className="btn-press text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ color: COLOR, border: `1px solid ${COLOR}40`, background: compareMode ? `${COLOR}20` : 'transparent' }}>
              {compareMode ? 'Done' : 'Compare'}
            </button>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="btn-press w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80 mb-3">
          {uploading ? <LoadingSpinner color={COLOR} size={18} /> : <><span>➕</span> Add photo</>}
        </button>

        {compareMode && (
          <p className="text-[11px] text-white/40 mb-3 text-center">
            Pick two photos to compare {picked.length > 0 ? `(${picked.length}/2)` : ''}
          </p>
        )}

        {/* Compare view */}
        {compareMode && pickedPhotos.length === 2 && (
          <div className="grid grid-cols-2 gap-2 mb-4 animate-slideUp">
            {pickedPhotos.map((p) => {
              const wt = weightNear(p.date)
              return (
                <div key={p.id} className="rounded-xl overflow-hidden bg-black/40 border border-white/10">
                  <img src={p.dataUrl} alt={p.date} className="w-full object-cover" style={{ maxHeight: 280 }} />
                  <div className="p-2 text-center">
                    <div className="text-[11px] font-bold text-white">{p.date}</div>
                    {wt != null && <div className="text-[10px]" style={{ color: COLOR }}>{fmtWt(wt)}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {lPhotos && <div className="flex justify-center py-4"><LoadingSpinner color={COLOR} size={22} /></div>}

        {sortedPhotos.length === 0 && !lPhotos ? (
          <div className="text-center py-6 text-white/30">
            <div className="text-3xl mb-1">📷</div>
            <p className="text-sm font-semibold">No photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {sortedPhotos.map((p) => {
              const isPicked = picked.includes(p.id)
              return (
                <div key={p.id} className="relative rounded-xl overflow-hidden bg-black/40 border transition-all"
                  style={{ borderColor: isPicked ? COLOR : 'rgba(255,255,255,0.1)', boxShadow: isPicked ? `0 0 12px ${COLOR}70` : 'none' }}>
                  <img src={p.dataUrl} alt={p.date}
                    onClick={() => compareMode ? togglePick(p.id) : setViewPhoto(p)}
                    className="w-full object-cover cursor-pointer" style={{ aspectRatio: '3 / 4' }} />
                  <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-[9px] font-bold text-white/90">{(p.date || '').slice(5)}</span>
                  </div>
                  {compareMode && isPicked && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: COLOR }}>✓</div>
                  )}
                  {!compareMode && (
                    <button onClick={() => deletePhoto(p.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white bg-black/60 hover:bg-red-500/80 transition-colors">✕</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ---- Weight log list ---- */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Weigh-in Log</div>
        {[...(weightLogs || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((w) => (
          <div key={w.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="flex-1">
              <span className="font-black text-sm" style={{ color: COLOR }}>{fmtWt(w.value)}</span>
              <span className="text-xs text-white/30 ml-2">{w.date}</span>
            </div>
            <button onClick={() => deleteWeight(w.id)} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
          </div>
        ))}
        {!lWeights && (weightLogs || []).length === 0 && (
          <div className="text-center py-10 text-white/30">
            <div className="text-4xl mb-2">⚖️</div>
            <p className="font-semibold text-sm">Log your first weigh-in</p>
          </div>
        )}
      </div>

      {/* ---- Log weight modal ---- */}
      <Modal isOpen={showWtModal} onClose={() => setShowWtModal(false)} title="Log Weight" accentColor={COLOR}>
        <form onSubmit={handleAddWeight} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Weight ({units})</label>
            <input type="number" step="0.1" inputMode="decimal" value={wtForm.value} onChange={(e) => setWtForm((f) => ({ ...f, value: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
              placeholder={units === 'lb' ? '165.0' : '75.0'} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={wtForm.date} onChange={(e) => setWtForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED] transition-colors" />
          </div>
          <div className="flex gap-2">
            {(weightLogs || []).slice(-3).reverse().map((w) => (
              <div key={w.id} className="flex-1 text-center glass-card py-2 rounded-xl">
                <div className="font-black text-sm" style={{ color: COLOR }}>{fmtWt(w.value)}</div>
                <div className="text-[9px] text-white/30 mt-0.5">{(w.date || '').slice(5)}</div>
              </div>
            ))}
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Save Weight
          </button>
        </form>
      </Modal>

      {/* ---- Goal weight modal ---- */}
      <Modal isOpen={showGoalModal} onClose={() => setShowGoalModal(false)} title="Goal Weight" accentColor={COLOR}>
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Target weight ({units})</label>
            <input type="number" step="0.1" inputMode="decimal" value={goalForm} onChange={(e) => setGoalForm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
              placeholder={units === 'lb' ? '155.0' : '70.0'} />
            <p className="text-[11px] text-white/35 mt-1.5">Leave blank and save to clear your goal. Projection uses your last 30 days of weigh-ins.</p>
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Save Goal
          </button>
        </form>
      </Modal>

      {/* ---- Log measurements modal ---- */}
      <Modal isOpen={showMeasModal} onClose={() => setShowMeasModal(false)} title="Log Measurements" accentColor={COLOR}>
        <form onSubmit={handleAddMeasurement} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={measForm.date} onChange={(e) => setMeasForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED] transition-colors" />
          </div>
          <p className="text-[11px] text-white/35">Enter values in cm. Leave blank to skip a metric.</p>
          <div className="grid grid-cols-2 gap-3">
            {MEAS_METRICS.map((m) => (
              <div key={m.key}>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">{m.icon} {m.label}</label>
                <input type="number" step="0.1" inputMode="decimal" value={measForm[m.key]}
                  onChange={(e) => setMeasForm((f) => ({ ...f, [m.key]: e.target.value }))}
                  placeholder="cm"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors" />
              </div>
            ))}
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Save Measurements
          </button>
        </form>
      </Modal>

      {/* ---- View single photo modal ---- */}
      <Modal isOpen={!!viewPhoto} onClose={() => setViewPhoto(null)} title={viewPhoto?.date || 'Photo'} accentColor={COLOR}>
        {viewPhoto && (
          <div className="space-y-3">
            <img src={viewPhoto.dataUrl} alt={viewPhoto.date} className="w-full rounded-xl" />
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">
                {viewPhoto.date}
                {weightNear(viewPhoto.date) != null && (
                  <span className="ml-2 font-bold" style={{ color: COLOR }}>{fmtWt(weightNear(viewPhoto.date))}</span>
                )}
              </div>
              <button onClick={() => { deletePhoto(viewPhoto.id); setViewPhoto(null) }}
                className="btn-press px-3 py-2 rounded-lg text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20">
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
