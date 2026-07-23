import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'
import { LineChart, BarChart } from '../components/charts/Charts'

const COLOR = '#7C3AED'
const CYAN = '#22D3EE'
const FAST_LS_KEY = 'wellness.activeFast'

/* ---------------- Local date helpers (LOCAL dates, never toISOString) ---------------- */
function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = () => localKey(new Date())
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localKey(d)
}
function prettyDate(dateStr) {
  if (!dateStr) return ''
  const t = todayStr()
  if (dateStr === t) return 'Today'
  if (dateStr === shiftDate(t, -1)) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
const nn = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}
// Build an array of the last `n` day-keys ending today.
function lastNDays(n) {
  const out = []
  const t = todayStr()
  for (let i = n - 1; i >= 0; i--) out.push(shiftDate(t, -i))
  return out
}
// Consecutive-day streak ending today from a completions array.
function calcStreak(completions) {
  if (!Array.isArray(completions) || !completions.length) return 0
  const set = new Set(completions)
  let streak = 0
  const d = new Date()
  while (set.has(localKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(nn(ms) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
function fmtHoursShort(ms) {
  const h = nn(ms) / 3600000
  return `${(Math.round(h * 10) / 10)}h`
}

/* ============================= PAGE ============================= */
const TABS = [
  { key: 'sleep', label: 'Sleep', icon: '🌙' },
  { key: 'activity', label: 'Activity', icon: '🏃' },
  { key: 'supplements', label: 'Supps', icon: '💊' },
  { key: 'fasting', label: 'Fasting', icon: '⏳' },
]

export default function Wellness() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('sleep')

  return (
    <div className="page-enter min-h-screen p-4 pt-10 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/')}
          className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10"
          aria-label="Back to dashboard"
        >
          ‹
        </button>
        <div>
          <div className="readout text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">// Vitals monitor</div>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-glow" style={{ color: COLOR }}>Wellness</h1>
        </div>
      </div>

      {/* Tab bar — HUD segmented control */}
      <div className="hud-panel flex gap-1 mb-6 p-1 rounded-2xl">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn-press flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-[250ms]"
              style={{
                background: active ? `linear-gradient(135deg, ${COLOR}, #6D28D9)` : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: active ? `0 0 22px ${COLOR}66, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
              }}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'sleep' && <SleepTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'supplements' && <SupplementsTab />}
      {tab === 'fasting' && <FastingTab />}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors'

/* ============================= SLEEP ============================= */
function SleepTab() {
  const { docs, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('sleep')
  const [showLog, setShowLog] = useState(false)

  useEffect(() => { fetchDocs() }, [fetchDocs])

  // Sort newest first by date.
  const sorted = useMemo(
    () => [...(docs || [])].filter((d) => d && d.date).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [docs]
  )
  const byDate = useMemo(() => {
    const m = {}
    for (const d of sorted) if (!m[d.date]) m[d.date] = d
    return m
  }, [sorted])

  const lastNight = sorted[0] || null

  const avg7 = useMemo(() => {
    const days = lastNDays(7)
    const vals = days.map((k) => byDate[k]).filter(Boolean).map((d) => nn(d.hours))
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }, [byDate])

  const hoursData = useMemo(
    () => lastNDays(14).map((k) => ({
      label: k.slice(8),
      value: byDate[k] ? nn(byDate[k].hours) : null,
    })),
    [byDate]
  )
  const qualityData = useMemo(
    () => lastNDays(14).map((k) => ({
      label: k.slice(8),
      value: byDate[k] ? nn(byDate[k].quality) : null,
    })),
    [byDate]
  )

  async function saveEntry({ date, hours, quality }) {
    const payload = { date, hours: nn(hours), quality: nn(quality) }
    const existing = (docs || []).find((d) => d.date === date && !String(d.id).startsWith('temp_'))
    if (existing) await updateDocument(existing.id, { hours: payload.hours, quality: payload.quality })
    else await addDocument(payload)
    setShowLog(false)
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => setShowLog(true)}
        className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
        style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}
      >
        + Log sleep
      </button>

      {loading && <div className="flex justify-center py-2"><LoadingSpinner color={COLOR} size={22} /></div>}

      <div className="grid grid-cols-2 gap-3">
        <Card accentColor={COLOR} className="p-4 text-center">
          <div className="readout text-[10px] font-semibold text-white/40 uppercase tracking-[0.22em]">Last night</div>
          <div className="readout text-2xl font-black text-white mt-1 text-glow">{lastNight ? `${nn(lastNight.hours)}h` : '–'}</div>
          <div className="text-[11px] text-white/40 mt-0.5" style={{ color: lastNight ? CYAN : undefined }}>
            {lastNight ? `${'★'.repeat(nn(lastNight.quality))}${'☆'.repeat(Math.max(0, 5 - nn(lastNight.quality)))}` : 'No entry'}
          </div>
        </Card>
        <Card accentColor={COLOR} className="p-4 text-center">
          <div className="readout text-[10px] font-semibold text-white/40 uppercase tracking-[0.22em]">7-day avg</div>
          <div className="readout text-2xl font-black text-white mt-1 text-glow">{avg7 != null ? `${avg7}h` : '–'}</div>
          <div className="text-[11px] text-white/40 mt-0.5">per night</div>
        </Card>
      </div>

      <Card accentColor={COLOR} className="p-4">
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Hours · last 14 days</div>
        <LineChart data={hoursData} color={COLOR} target={8} yLabel="h" />
      </Card>

      <Card accentColor={COLOR} className="p-4">
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Quality trend · 1–5</div>
        <LineChart data={qualityData} color={CYAN} />
      </Card>

      <div>
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Recent nights</div>
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <div className="text-3xl mb-2">🌙</div>
            <p className="text-sm font-semibold">No sleep logged yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.slice(0, 14).map((d) => (
              <div key={d.id} className="hairline-b flex items-center gap-3 py-3 px-1">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85">{prettyDate(d.date)}</div>
                  <div className="readout text-[11px] text-white/40">
                    {nn(d.hours)}h · <span style={{ color: CYAN }}>{'★'.repeat(nn(d.quality))}{'☆'.repeat(Math.max(0, 5 - nn(d.quality)))}</span>
                  </div>
                </div>
                <button onClick={() => deleteDocument(d.id)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SleepModal isOpen={showLog} onClose={() => setShowLog(false)} onSave={saveEntry} />
    </div>
  )
}

function SleepModal({ isOpen, onClose, onSave }) {
  const [date, setDate] = useState(todayStr())
  const [hours, setHours] = useState(8)
  const [quality, setQuality] = useState(3)

  useEffect(() => {
    if (isOpen) { setDate(todayStr()); setHours(8); setQuality(3) }
  }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Sleep" accentColor={COLOR}>
      <div className="space-y-4">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Hours slept">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setHours((h) => Math.max(0, Math.round((h - 0.5) * 10) / 10))}
              className="btn-press w-11 h-11 rounded-xl text-lg font-bold text-white/70 bg-white/5 border border-white/10">−</button>
            <span className="flex-1 text-center text-xl font-black text-white">{hours}h</span>
            <button type="button" onClick={() => setHours((h) => Math.min(24, Math.round((h + 0.5) * 10) / 10))}
              className="btn-press w-11 h-11 rounded-xl text-lg font-bold text-white" style={{ background: COLOR }}>+</button>
          </div>
        </Field>
        <Field label="Quality">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((q) => {
              const on = quality === q
              return (
                <button key={q} type="button" onClick={() => setQuality(q)}
                  className="btn-press py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: on ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                    color: on ? COLOR : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${on ? COLOR + '60' : 'transparent'}`,
                  }}>
                  {q}
                </button>
              )
            })}
          </div>
        </Field>
        <button type="button" onClick={() => onSave({ date, hours, quality })}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
          style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
          Save
        </button>
      </div>
    </Modal>
  )
}

/* ============================= ACTIVITY / CARDIO ============================= */
const CARDIO_TYPES = [
  { key: 'Walk', icon: '🚶' },
  { key: 'Run', icon: '🏃' },
  { key: 'Cycle', icon: '🚴' },
  { key: 'Swim', icon: '🏊' },
  { key: 'Other', icon: '✨' },
]

function ActivityTab() {
  const { docs, loading, fetchDocs, addDocument, deleteDocument } = useFirestore('cardio')
  const [showLog, setShowLog] = useState(false)

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const sorted = useMemo(
    () => [...(docs || [])].filter((d) => d && d.date).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [docs]
  )

  const weekKeys = useMemo(() => new Set(lastNDays(7)), [todayStr()])
  const weekTotals = useMemo(() => {
    let minutes = 0, steps = 0
    for (const d of sorted) {
      if (weekKeys.has(d.date)) { minutes += nn(d.minutes); steps += nn(d.steps) }
    }
    return { minutes, steps }
  }, [sorted, weekKeys])

  const minutesData = useMemo(() => {
    const map = {}
    for (const d of sorted) map[d.date] = (map[d.date] || 0) + nn(d.minutes)
    return lastNDays(14).map((k) => ({ label: k.slice(8), value: map[k] || 0 }))
  }, [sorted])

  async function saveSession(payload) {
    await addDocument({
      date: payload.date,
      type: payload.type,
      minutes: nn(payload.minutes),
      steps: nn(payload.steps),
      notes: String(payload.notes || ''),
    })
    setShowLog(false)
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => setShowLog(true)}
        className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
        style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}
      >
        + Log session
      </button>

      {loading && <div className="flex justify-center py-2"><LoadingSpinner color={COLOR} size={22} /></div>}

      <div className="grid grid-cols-2 gap-3">
        <Card accentColor={COLOR} className="p-4 text-center">
          <div className="readout text-[10px] font-semibold text-white/40 uppercase tracking-[0.22em]">This week</div>
          <div className="readout text-2xl font-black text-white mt-1 text-glow">{weekTotals.minutes}<span className="text-white/30 text-base font-bold">m</span></div>
          <div className="text-[11px] text-white/40 mt-0.5">active minutes</div>
        </Card>
        <Card accentColor={COLOR} className="p-4 text-center">
          <div className="readout text-[10px] font-semibold text-white/40 uppercase tracking-[0.22em]">Steps · 7d</div>
          <div className="readout text-2xl font-black text-white mt-1 text-glow">{weekTotals.steps.toLocaleString()}</div>
          <div className="text-[11px] text-white/40 mt-0.5">total</div>
        </Card>
      </div>

      <Card accentColor={COLOR} className="p-4">
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Minutes · last 14 days</div>
        <BarChart data={minutesData} color={COLOR} />
      </Card>

      <div>
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Recent sessions</div>
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <div className="text-3xl mb-2">🏃</div>
            <p className="text-sm font-semibold">No sessions logged yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.slice(0, 20).map((d) => {
              const t = CARDIO_TYPES.find((x) => x.key === d.type)
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                  <span className="text-lg flex-shrink-0" style={{ filter: `drop-shadow(0 0 6px ${COLOR}88)` }}>{t?.icon || '✨'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white/85 truncate">
                      {d.type || 'Other'} · <span className="readout">{nn(d.minutes)}m{nn(d.steps) > 0 ? ` · ${nn(d.steps).toLocaleString()} steps` : ''}</span>
                    </div>
                    <div className="text-[11px] text-white/40 truncate">
                      {prettyDate(d.date)}{d.notes ? ` · ${d.notes}` : ''}
                    </div>
                  </div>
                  <button onClick={() => deleteDocument(d.id)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ActivityModal isOpen={showLog} onClose={() => setShowLog(false)} onSave={saveSession} />
    </div>
  )
}

function ActivityModal({ isOpen, onClose, onSave }) {
  const [date, setDate] = useState(todayStr())
  const [type, setType] = useState('Walk')
  const [minutes, setMinutes] = useState('')
  const [steps, setSteps] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) { setDate(todayStr()); setType('Walk'); setMinutes(''); setSteps(''); setNotes('') }
  }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Activity" accentColor={COLOR}>
      <div className="space-y-4">
        <Field label="Type">
          <div className="grid grid-cols-5 gap-2">
            {CARDIO_TYPES.map((t) => {
              const on = type === t.key
              return (
                <button key={t.key} type="button" onClick={() => setType(t.key)}
                  className="btn-press py-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-0.5"
                  style={{
                    background: on ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                    color: on ? COLOR : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${on ? COLOR + '60' : 'transparent'}`,
                  }}>
                  <span className="text-base">{t.icon}</span>{t.key}
                </button>
              )
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes">
            <input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputCls} placeholder="30" />
          </Field>
          <Field label="Steps (optional)">
            <input type="number" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} className={inputCls} placeholder="0" />
          </Field>
        </div>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Notes (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Morning loop around the park" />
        </Field>
        <button type="button" onClick={() => onSave({ date, type, minutes, steps, notes })}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
          style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
          Save
        </button>
      </div>
    </Modal>
  )
}

/* ============================= SUPPLEMENTS ============================= */
const STARTER_SUPPS = ['Creatine', 'Vitamin D', 'Fish Oil', 'Magnesium']

function SupplementsTab() {
  const { docs, loading, fetchDocs, addDocument, updateDocument, deleteDocument } = useFirestore('supplements')
  const [name, setName] = useState('')

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const today = todayStr()
  const week = useMemo(() => lastNDays(7), [todayStr()])

  const list = useMemo(() => [...(docs || [])].filter(Boolean), [docs])

  async function addSupp(n) {
    const clean = String(n || '').trim()
    if (!clean) return
    await addDocument({ name: clean, completions: [] })
    setName('')
  }
  async function toggleToday(supp) {
    const completions = [...(supp.completions || [])]
    const idx = completions.indexOf(today)
    if (idx >= 0) completions.splice(idx, 1)
    else completions.push(today)
    await updateDocument(supp.id, { completions })
  }
  async function seed() {
    for (const s of STARTER_SUPPS) await addDocument({ name: s, completions: [] })
  }

  return (
    <div className="space-y-5">
      <Card accentColor={COLOR} className="p-4">
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Add supplement</div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSupp(name)}
            className={inputCls} placeholder="e.g. Zinc" />
          <button onClick={() => addSupp(name)} className="btn-press px-5 rounded-xl font-bold text-white" style={{ background: COLOR, boxShadow: `0 0 18px ${COLOR}55` }}>+</button>
        </div>
      </Card>

      {loading && <div className="flex justify-center py-2"><LoadingSpinner color={COLOR} size={22} /></div>}

      {list.length === 0 ? (
        <div className="text-center py-6 text-white/30">
          <div className="text-3xl mb-2">💊</div>
          <p className="text-sm font-semibold mb-3">No supplements yet</p>
          <button onClick={seed}
            className="btn-press w-full py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
            ➕ Add starter set
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Today's checklist</div>
          {list.map((s) => {
            const completions = s.completions || []
            const done = completions.includes(today)
            const streak = calcStreak(completions)
            return (
              <div key={s.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleToday(s)}
                    className="btn-press w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: done ? COLOR : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${done ? COLOR : 'rgba(255,255,255,0.15)'}`,
                      boxShadow: done ? `0 0 12px ${COLOR}60` : 'none',
                    }}
                  >
                    {done && <span className="text-white text-sm animate-checkmark">✓</span>}
                  </button>
                  <span className={`flex-1 text-sm font-bold ${done ? 'text-white/50' : 'text-white'}`}>{s.name}</span>
                  <span className="readout text-sm font-black flex-shrink-0" style={{ color: streak > 0 ? '#F97316' : 'rgba(255,255,255,0.35)', textShadow: streak > 0 ? '0 0 12px rgba(249,115,22,0.5)' : 'none' }}>{streak > 0 ? `${streak}🔥` : '–'}</span>
                  <button onClick={() => deleteDocument(s.id)} className="text-white/15 hover:text-red-400 transition-colors text-sm flex-shrink-0">✕</button>
                </div>
                <div className="flex gap-1.5 mt-2.5 pl-11">
                  {week.map((k) => {
                    const on = completions.includes(k)
                    return (
                      <div key={k} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full h-2.5 rounded-full transition-all"
                          style={{ background: on ? COLOR : 'rgba(255,255,255,0.08)', boxShadow: on ? `0 0 8px ${COLOR}aa` : 'none' }} />
                        <span className="readout text-[8px] text-white/30">{k.slice(8)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================= FASTING ============================= */
const FAST_PRESETS = [
  { label: '14h', hours: 14 },
  { label: '16h', hours: 16 },
  { label: '18h', hours: 18 },
  { label: '20h', hours: 20 },
  { label: 'OMAD 23h', hours: 23 },
]

function readActiveFast() {
  try {
    const raw = localStorage.getItem(FAST_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.start && Number.isFinite(new Date(parsed.start).getTime())) return parsed
    return null
  } catch {
    return null
  }
}

function FastingTab() {
  const { docs, loading, fetchDocs, addDocument, deleteDocument } = useFirestore('fasting')
  const [active, setActive] = useState(() => readActiveFast()) // { start, targetHours }
  const [now, setNow] = useState(Date.now())
  const [targetHours, setTargetHours] = useState(() => readActiveFast()?.targetHours || 16)
  const timerRef = useRef(null)

  useEffect(() => { fetchDocs() }, [fetchDocs])

  // Live ticking only while a fast is active; cleaned up on unmount / when stopped.
  useEffect(() => {
    if (!active) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    setNow(Date.now())
    timerRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [active])

  const startMs = active ? new Date(active.start).getTime() : 0
  const elapsed = active ? Math.max(0, now - startMs) : 0
  const target = nn(active?.targetHours || targetHours) || 16
  const targetMs = target * 3600000
  const progress = targetMs > 0 ? Math.min(1, elapsed / targetMs) : 0

  const completed = useMemo(
    () => [...(docs || [])]
      .filter((d) => d && d.start && d.end)
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
    [docs]
  )

  const week7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000
    const recent = completed.filter((d) => new Date(d.start).getTime() >= cutoff)
    const totalMs = recent.reduce((a, d) => a + Math.max(0, new Date(d.end).getTime() - new Date(d.start).getTime()), 0)
    return { count: recent.length, avgMs: recent.length ? totalMs / recent.length : 0 }
  }, [completed])

  function startFast() {
    const record = { start: new Date().toISOString(), targetHours: nn(targetHours) || 16 }
    try { localStorage.setItem(FAST_LS_KEY, JSON.stringify(record)) } catch { /* ignore */ }
    setActive(record)
  }
  async function endFast() {
    if (!active) return
    const end = new Date().toISOString()
    const duration = Math.max(0, new Date(end).getTime() - new Date(active.start).getTime())
    try { localStorage.removeItem(FAST_LS_KEY) } catch { /* ignore */ }
    setActive(null)
    await addDocument({
      start: active.start,
      end,
      targetHours: nn(active.targetHours) || 16,
      durationMs: duration,
    })
  }
  function cancelFast() {
    try { localStorage.removeItem(FAST_LS_KEY) } catch { /* ignore */ }
    setActive(null)
  }

  return (
    <div className="space-y-5">
      {/* Live timer — HUD fasting instrument */}
      <Card accentColor={COLOR} className="p-5 text-center">
        {active ? (
          <>
            <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-[0.28em]">Fasting · target {target}h</div>
            {/* Glowing progress ring with mono countdown at the centre */}
            <div className="relative mx-auto mt-4" style={{ width: 200, height: 200 }}>
              <svg width={200} height={200} className="-rotate-90">
                <defs>
                  <filter id="fastGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="2.6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <circle cx={100} cy={100} r={88} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
                <circle
                  cx={100} cy={100} r={88} fill="none"
                  stroke={progress >= 1 ? '#10B981' : COLOR} strokeWidth={9} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 88}
                  strokeDashoffset={2 * Math.PI * 88 * (1 - progress)}
                  filter="url(#fastGlow)"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="readout text-[9px] uppercase tracking-[0.28em] text-white/40">Elapsed</div>
                <div className="readout text-xl leading-none font-black text-white text-glow mt-1.5">{fmtDuration(elapsed)}</div>
                <div className="readout text-[12px] font-bold mt-2" style={{ color: progress >= 1 ? '#10B981' : COLOR }}>
                  {Math.round(progress * 100)}%
                </div>
              </div>
            </div>
            <div className="readout text-[11px] text-white/45 mt-3">
              {progress >= 1 ? 'Target reached 🎉' : `${fmtHoursShort(Math.max(0, targetMs - elapsed))} to go`}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={cancelFast}
                className="btn-press py-3 rounded-xl font-bold text-sm text-white/50 bg-white/5 border border-white/10">
                Cancel
              </button>
              <button onClick={endFast}
                className="btn-press py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
                End fast
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-[0.28em]">No active fast</div>
            <div className="text-2xl font-black text-white mt-2 text-glow">Ready when you are</div>
            <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mt-4 mb-2">Target window</div>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {FAST_PRESETS.map((p) => {
                const on = nn(targetHours) === p.hours
                return (
                  <button key={p.hours} onClick={() => setTargetHours(p.hours)}
                    className="btn-press py-2 rounded-xl text-[11px] font-bold transition-all"
                    style={{
                      background: on ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                      color: on ? COLOR : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${on ? COLOR + '60' : 'transparent'}`,
                      boxShadow: on ? `0 0 14px ${COLOR}44` : 'none',
                    }}>
                    {p.label}
                  </button>
                )
              })}
            </div>
            <button onClick={startFast}
              className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
              Start fast
            </button>
          </>
        )}
      </Card>

      {loading && <div className="flex justify-center py-2"><LoadingSpinner color={COLOR} size={22} /></div>}

      {/* 7-day summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card accentColor={COLOR} className="p-4 text-center">
          <div className="readout text-[10px] font-semibold text-white/40 uppercase tracking-[0.22em]">Fasts · 7d</div>
          <div className="readout text-2xl font-black text-white mt-1 text-glow">{week7.count}</div>
          <div className="text-[11px] text-white/40 mt-0.5">completed</div>
        </Card>
        <Card accentColor={COLOR} className="p-4 text-center">
          <div className="readout text-[10px] font-semibold text-white/40 uppercase tracking-[0.22em]">Avg length</div>
          <div className="readout text-2xl font-black text-white mt-1 text-glow">{week7.count ? fmtHoursShort(week7.avgMs) : '–'}</div>
          <div className="text-[11px] text-white/40 mt-0.5">per fast</div>
        </Card>
      </div>

      {/* History */}
      <div>
        <div className="readout text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">History</div>
        {completed.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <div className="text-3xl mb-2">⏳</div>
            <p className="text-sm font-semibold">No completed fasts yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completed.slice(0, 20).map((d) => {
              const dur = nn(d.durationMs) || Math.max(0, new Date(d.end).getTime() - new Date(d.start).getTime())
              const hitTarget = dur >= nn(d.targetHours) * 3600000
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="flex-1 min-w-0">
                    <div className="readout text-sm font-bold text-white/85">
                      {fmtHoursShort(dur)} {hitTarget && <span style={{ color: '#10B981', textShadow: '0 0 10px #10B98188' }}>✓</span>}
                    </div>
                    <div className="readout text-[11px] text-white/40">
                      {new Date(d.start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · target {nn(d.targetHours)}h
                    </div>
                  </div>
                  <button onClick={() => deleteDocument(d.id)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
