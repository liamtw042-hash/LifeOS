import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import Card from '../Card'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import { generateCoachInsights } from '../../lib/coach'
import { BarChart, LineChart } from '../charts/Charts'

const COLOR = '#7C3AED'
const TONE = { good: '#10B981', warn: '#F97316', info: '#7C3AED' }
const DEFAULT_TARGETS = { calories: 2200, protein: 150 }

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
  const { docs: profiles, fetchDocs: fetchProfile } = useFirestore('fitnessProfile')
  const { docs: sessions, fetchDocs: fetchSessions } = useFirestore('workoutSessions')
  const { docs: habits, fetchDocs: fetchHabits } = useFirestore('habits')
  const {
    docs: photos, loading: lPhotos, fetchDocs: fetchPhotos,
    addDocument: addPhoto, deleteDocument: deletePhoto,
  } = useFirestore('progressPhotos')

  const [showWtModal, setShowWtModal] = useState(false)
  const [wtForm, setWtForm] = useState({ value: '', date: todayStr() })
  const [uploading, setUploading] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [picked, setPicked] = useState([]) // photo ids
  const [viewPhoto, setViewPhoto] = useState(null)
  const [nutRange, setNutRange] = useState(7)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchWeights(); fetchFood(); fetchProfile()
    fetchSessions(); fetchHabits(); fetchPhotos()
  }, [fetchWeights, fetchFood, fetchProfile, fetchSessions, fetchHabits, fetchPhotos])

  const today = todayStr()

  // ---- weight data ----
  const sorted = useMemo(
    () => [...(weightLogs || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [weightLogs]
  )
  const chartPoints = sorted.slice(-14)

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
    await addWeight({ value: Number(wtForm.value), date: wtForm.date })
    setWtForm({ value: '', date: todayStr() })
    setShowWtModal(false)
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
        <button onClick={() => setShowWtModal(true)}
          className="btn-press h-10 px-4 rounded-full text-sm font-bold text-white flex items-center gap-1"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>⚖️ Log</button>
      </div>

      {lWeights && <div className="flex justify-center py-4"><LoadingSpinner color={COLOR} size={26} /></div>}

      {/* ---- Trend chart ---- */}
      {chartPoints.length > 0 && (
        <Card accentColor={COLOR} className="p-4">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Bodyweight Trend</div>
          <div className="flex items-end gap-1.5 h-24">
            {chartPoints.map((w, i) => {
              const vals = chartPoints.map((x) => Number(x.value) || 0)
              const min = Math.min(...vals)
              const max = Math.max(...vals)
              const range = max - min || 1
              const pct = ((Number(w.value) - min) / range) * 68 + 18
              const isLast = i === chartPoints.length - 1
              return (
                <div key={w.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <span className="text-[8px] text-white/40">{w.value}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{ height: `${pct}px`, background: isLast ? COLOR : `${COLOR}40`, boxShadow: isLast ? `0 0 8px ${COLOR}80` : 'none' }} />
                  <span className="text-[7px] text-white/25 whitespace-nowrap">{(w.date || '').slice(5)}</span>
                </div>
              )
            })}
          </div>

          {/* Weekly summary */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
            <div className="text-center">
              <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">This wk avg</div>
              <div className="text-sm font-black text-white">{weekly.tw != null ? `${weekly.tw.toFixed(1)}kg` : '–'}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Last wk avg</div>
              <div className="text-sm font-black text-white">{weekly.lw != null ? `${weekly.lw.toFixed(1)}kg` : '–'}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Net</div>
              <div className="text-sm font-black" style={{ color: weekly.net == null ? '#fff' : weekly.net <= 0 ? '#10B981' : '#F97316' }}>
                {weekly.net == null ? '–' : `${weekly.net > 0 ? '+' : ''}${weekly.net.toFixed(1)}kg`}
              </div>
            </div>
          </div>
        </Card>
      )}

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
                    {wt != null && <div className="text-[10px]" style={{ color: COLOR }}>{wt}kg</div>}
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
              <span className="font-black text-sm" style={{ color: COLOR }}>{w.value}kg</span>
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
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Weight (kg)</label>
            <input type="number" step="0.1" value={wtForm.value} onChange={(e) => setWtForm((f) => ({ ...f, value: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
              placeholder="75.0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={wtForm.date} onChange={(e) => setWtForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED] transition-colors" />
          </div>
          <div className="flex gap-2">
            {(weightLogs || []).slice(-3).reverse().map((w) => (
              <div key={w.id} className="flex-1 text-center glass-card py-2 rounded-xl">
                <div className="font-black text-sm" style={{ color: COLOR }}>{w.value}kg</div>
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

      {/* ---- View single photo modal ---- */}
      <Modal isOpen={!!viewPhoto} onClose={() => setViewPhoto(null)} title={viewPhoto?.date || 'Photo'} accentColor={COLOR}>
        {viewPhoto && (
          <div className="space-y-3">
            <img src={viewPhoto.dataUrl} alt={viewPhoto.date} className="w-full rounded-xl" />
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">
                {viewPhoto.date}
                {weightNear(viewPhoto.date) != null && (
                  <span className="ml-2 font-bold" style={{ color: COLOR }}>{weightNear(viewPhoto.date)}kg</span>
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
