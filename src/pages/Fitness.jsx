import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'
import MacroRings from '../components/fitness/MacroRings'
import BarcodeScanner from '../components/fitness/BarcodeScanner'
import TrainTab from '../components/fitness/TrainTab'
import ProgressTab from '../components/fitness/ProgressTab'
import { FOODS } from '../data/foods'
import { parseInlineMacros, parseFoodText } from '../lib/foodParser'
import { calcTargets, ACTIVITY_LEVELS } from '../lib/nutrition'

const COLOR = '#7C3AED'
const DEFAULT_TARGETS = { calories: 2200, protein: 150, carbs: 220, fat: 70 }
const WATER_GOAL_ML = 2000
const CUP_ML = 250

const ACTIVITY_LABELS = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  veryActive: 'Very active',
}
const GOAL_LABELS = { cut: 'Cut', maintain: 'Maintain', bulk: 'Bulk' }

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
  const d = new Date(dateStr + 'T00:00:00')
  const t = todayStr()
  if (dateStr === t) return 'Today'
  if (dateStr === shiftDate(t, -1)) return 'Yesterday'
  if (dateStr === shiftDate(t, 1)) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function sumTotals(items) {
  return (items || []).reduce(
    (a, it) => ({
      cal: a.cal + (Number(it.cal) || 0),
      p: a.p + (Number(it.p) || 0),
      c: a.c + (Number(it.c) || 0),
      f: a.f + (Number(it.f) || 0),
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )
}

export default function Fitness() {
  const [tab, setTab] = useState('food')

  return (
    <div className="page-enter min-h-screen p-4 pt-10 pb-24">
      <div className="mb-5">
        <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Fitness</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 p-1 rounded-2xl bg-white/5 border border-white/10">
        {[
          { key: 'food', label: 'Food', icon: '🍽️' },
          { key: 'train', label: 'Train', icon: '💪' },
          { key: 'progress', label: 'Progress', icon: '📈' },
        ].map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: active ? COLOR : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: active ? `0 0 20px ${COLOR}55` : 'none',
              }}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'food' && <FoodTab />}
      {tab === 'train' && <TrainTab />}
      {tab === 'progress' && <ProgressTab />}
    </div>
  )
}

/* ============================= FOOD TAB ============================= */

function FoodTab() {
  const {
    docs: foodLogs, loading: lLog, fetchDocs: fetchLogs,
    addDocument: addLog, updateDocument: updateLog,
  } = useFirestore('foodLog')
  const {
    docs: customFoods, fetchDocs: fetchCustom, addDocument: addCustom,
  } = useFirestore('customFoods')
  const {
    docs: templates, fetchDocs: fetchTemplates, addDocument: addTemplate,
  } = useFirestore('mealTemplates')
  const {
    docs: profiles, fetchDocs: fetchProfile, addDocument: addProfile, updateDocument: updateProfile,
  } = useFirestore('fitnessProfile')

  const [date, setDate] = useState(todayStr())
  const [nlText, setNlText] = useState('')
  const [preview, setPreview] = useState(null) // { items, totals, unmatched, custom? }
  const [search, setSearch] = useState('')
  const [qtyMap, setQtyMap] = useState({})
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', cal: '', p: '', c: '', f: '', serving: '' })

  useEffect(() => {
    fetchLogs(); fetchCustom(); fetchTemplates(); fetchProfile()
  }, [fetchLogs, fetchCustom, fetchTemplates, fetchProfile])

  const allFoods = useMemo(() => {
    const customMapped = (customFoods || []).map((c) => ({
      name: c.name, cal: c.cal, p: c.p, c: c.c, f: c.f, serving: c.serving,
    }))
    return [...customMapped, ...FOODS]
  }, [customFoods])

  const dayDoc = useMemo(() => (foodLogs || []).find((d) => d.date === date) || null, [foodLogs, date])
  const items = dayDoc?.items || []
  const water = Number(dayDoc?.water) || 0
  const totals = useMemo(() => sumTotals(items), [items])

  const profile = (profiles || [])[0] || null
  const targets = profile
    ? {
        calories: profile.calories || DEFAULT_TARGETS.calories,
        protein: profile.protein || DEFAULT_TARGETS.protein,
        carbs: profile.carbs || DEFAULT_TARGETS.carbs,
        fat: profile.fat || DEFAULT_TARGETS.fat,
      }
    : DEFAULT_TARGETS

  // ---- persistence helpers ----
  async function persistDay(nextItems, nextWater) {
    const existing = (foodLogs || []).find((d) => d.date === date)
    const payload = { date, items: nextItems, water: nextWater }
    if (existing) {
      await updateLog(existing.id, { items: nextItems, water: nextWater })
    } else {
      await addLog(payload)
    }
  }
  function addItems(newItems) {
    const cleaned = (newItems || []).map((it) => ({
      name: String(it.name || 'Food'),
      cal: Math.round(Number(it.cal) || 0),
      p: Math.round(Number(it.p) || 0),
      c: Math.round(Number(it.c) || 0),
      f: Math.round(Number(it.f) || 0),
      qty: Number(it.qty) || 1,
    }))
    if (!cleaned.length) return
    persistDay([...items, ...cleaned], water)
  }
  function removeItem(idx) {
    persistDay(items.filter((_, i) => i !== idx), water)
  }
  function changeWater(delta) {
    persistDay(items, Math.max(0, water + delta))
  }

  // ---- natural language + inline macros ----
  function handleParse() {
    const text = nlText.trim()
    if (!text) return
    const inline = parseInlineMacros(text)
    if (inline) {
      setPreview({
        items: [{ ...inline, qty: 1 }],
        totals: { cal: inline.cal, p: inline.p, c: inline.c, f: inline.f },
        unmatched: [],
        custom: true,
      })
      return
    }
    const parsed = parseFoodText(text, allFoods)
    setPreview(parsed)
  }
  function confirmPreview() {
    if (preview?.items?.length) addItems(preview.items)
    setPreview(null)
    setNlText('')
  }

  // ---- voice ----
  const SpeechRec = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  function startVoice() {
    if (!SpeechRec) return
    // If already listening, tapping the mic stops the current recognizer.
    if (listening && recRef.current) {
      try { recRef.current.stop() } catch (e) { /* ignore */ }
      return
    }
    try {
      const rec = new SpeechRec()
      recRef.current = rec
      rec.lang = 'en-AU'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript || ''
        if (!transcript) return
        setNlText((prev) => (prev ? prev + ' ' + transcript : transcript))
        // Parse the transcript directly — handleParse() would close over stale nlText.
        const inline = parseInlineMacros(transcript)
        if (inline) {
          setPreview({
            items: [{ ...inline, qty: 1 }],
            totals: { cal: inline.cal, p: inline.p, c: inline.c, f: inline.f },
            unmatched: [],
            custom: true,
          })
        } else {
          setPreview(parseFoodText(transcript, allFoods))
        }
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      setListening(true)
      rec.start()
    } catch (e) {
      setListening(false)
    }
  }

  // Cleanup any active recognizer on unmount.
  useEffect(() => {
    return () => {
      try { recRef.current?.abort() } catch (e) { /* ignore */ }
    }
  }, [])

  // ---- picker ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allFoods.slice(0, 30)
    return allFoods
      .filter((food) => {
        if (String(food.name).toLowerCase().includes(q)) return true
        return (food.aliases || []).some((a) => String(a).toLowerCase().includes(q))
      })
      .slice(0, 40)
  }, [search, allFoods])

  function qtyFor(name) {
    return qtyMap[name] || 1
  }
  function bumpQty(name, delta) {
    setQtyMap((m) => ({ ...m, [name]: Math.max(1, (m[name] || 1) + delta) }))
  }
  function addFood(food, qty = 1) {
    addItems([
      {
        name: food.name,
        cal: (Number(food.cal) || 0) * qty,
        p: (Number(food.p) || 0) * qty,
        c: (Number(food.c) || 0) * qty,
        f: (Number(food.f) || 0) * qty,
        qty,
      },
    ])
  }

  // ---- recent foods ----
  const recentFoods = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const log of foodLogs || []) {
      for (const it of log.items || []) {
        const key = String(it.name)
        if (seen.has(key)) continue
        seen.add(key)
        const match = allFoods.find((f) => f.name === it.name)
        out.push(match || { name: it.name, cal: it.cal, p: it.p, c: it.c, f: it.f, serving: '' })
        if (out.length >= 10) return out
      }
    }
    return out
  }, [foodLogs, allFoods])

  // ---- copy yesterday ----
  function copyYesterday() {
    const y = shiftDate(date, -1)
    const yDoc = (foodLogs || []).find((d) => d.date === y)
    if (yDoc?.items?.length) addItems(yDoc.items)
  }

  // ---- templates ----
  function saveTemplate() {
    if (!items.length) return
    const name = window.prompt('Template name?')
    if (!name) return
    addTemplate({ name: name.trim(), items })
  }
  function applyTemplate(tpl) {
    if (tpl?.items?.length) addItems(tpl.items)
    setShowTemplates(false)
  }

  // ---- custom food ----
  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customForm.name) return
    await addCustom({
      name: customForm.name.trim(),
      cal: Math.round(Number(customForm.cal) || 0),
      p: Math.round(Number(customForm.p) || 0),
      c: Math.round(Number(customForm.c) || 0),
      f: Math.round(Number(customForm.f) || 0),
      serving: customForm.serving.trim() || '1 serving',
    })
    setCustomForm({ name: '', cal: '', p: '', c: '', f: '', serving: '' })
    setShowCustom(false)
  }

  // ---- targets ----
  async function saveTargets(form) {
    const t = calcTargets(form)
    const payload = { ...form, ...t }
    const existing = (profiles || [])[0]
    if (existing) await updateProfile(existing.id, payload)
    else await addProfile(payload)
    setShowTargets(false)
  }

  const cups = Math.round(water / CUP_ML)
  const goalCups = Math.round(WATER_GOAL_ML / CUP_ML)

  return (
    <div className="space-y-5">
      {/* Date switcher */}
      <div className="flex items-center justify-between">
        <button onClick={() => setDate((d) => shiftDate(d, -1))}
          className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10">‹</button>
        <div className="text-center">
          <div className="font-bold text-white">{prettyDate(date)}</div>
          <div className="text-[11px] text-white/35">{date}</div>
        </div>
        <button onClick={() => setDate((d) => shiftDate(d, 1))}
          className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10">›</button>
      </div>

      {/* Macro rings */}
      <Card accentColor={COLOR} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Macros vs Target</div>
          <button onClick={() => setShowTargets(true)}
            className="btn-press text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ color: COLOR, border: `1px solid ${COLOR}40` }}>
            {profile ? 'Edit targets' : 'Set targets'}
          </button>
        </div>
        <MacroRings totals={totals} targets={targets} />
      </Card>

      {lLog && <div className="flex justify-center py-2"><LoadingSpinner color={COLOR} size={22} /></div>}

      {/* Natural language + voice */}
      <Card accentColor={COLOR} className="p-4">
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Quick Log</div>
        <textarea
          value={nlText}
          onChange={(e) => setNlText(e.target.value)}
          rows={2}
          placeholder='e.g. "big bowl of just right with milk and a protein shake" or "200 cal 20g protein"'
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:border-[#7C3AED] transition-colors"
        />
        <div className="flex gap-2 mt-2">
          {SpeechRec && (
            <button onClick={startVoice} type="button"
              className="btn-press w-11 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: listening ? COLOR : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: listening ? `0 0 16px ${COLOR}70` : 'none',
              }}
              title="Voice input">🎤</button>
          )}
          <button onClick={handleParse} type="button"
            className="btn-press flex-1 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
            Parse
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 animate-slideUp">
            {preview.items.length === 0 ? (
              <p className="text-sm text-white/50">No foods recognised. Try tap-to-add below or add a custom food.</p>
            ) : (
              <>
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Preview</div>
                <div className="space-y-1.5">
                  {preview.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-white/80">
                        {it.qty && it.qty !== 1 ? <span className="text-white/40">{it.qty}× </span> : null}{it.name}
                      </span>
                      <span className="text-white/45 text-xs">{it.cal} cal · {it.p}p {it.c}c {it.f}f</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-sm">
                  <span className="font-bold text-white">Total</span>
                  <span className="font-bold" style={{ color: COLOR }}>
                    {preview.totals.cal} cal · {preview.totals.p}p {preview.totals.c}c {preview.totals.f}f
                  </span>
                </div>
                {preview.unmatched?.length > 0 && (
                  <p className="text-[11px] text-white/30 mt-1.5">Unmatched: {preview.unmatched.join(', ')}</p>
                )}
              </>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPreview(null)}
                className="btn-press flex-1 py-2 rounded-lg text-sm font-semibold text-white/50 bg-white/5 border border-white/10">
                Cancel
              </button>
              {preview.items.length > 0 && (
                <button onClick={confirmPreview}
                  className="btn-press flex-1 py-2 rounded-lg text-sm font-bold text-white"
                  style={{ background: COLOR }}>
                  Add all
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setShowScanner(true)}
          className="btn-press py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80">
          <span>📷</span> Scan barcode
        </button>
        <button onClick={() => setShowCustom(true)}
          className="btn-press py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80">
          <span>➕</span> Custom food
        </button>
        <button onClick={copyYesterday}
          className="btn-press py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80">
          <span>📋</span> Copy yesterday
        </button>
        <button onClick={() => setShowTemplates(true)}
          className="btn-press py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80">
          <span>🗂️</span> Templates
        </button>
      </div>

      {/* Recent foods */}
      {recentFoods.length > 0 && (
        <div>
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Recent</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {recentFoods.map((f, i) => (
              <button key={i} onClick={() => addFood(f, 1)}
                className="btn-press flex-shrink-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-left">
                <div className="text-xs font-bold text-white/85 whitespace-nowrap">{f.name}</div>
                <div className="text-[10px] text-white/40">{Math.round(Number(f.cal) || 0)} cal</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Water tracker */}
      <Card accentColor={COLOR} className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Water</div>
            <div className="text-lg font-black text-white mt-0.5">
              {water}ml <span className="text-sm text-white/40 font-semibold">/ {WATER_GOAL_ML}ml</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => changeWater(-CUP_ML)}
              className="btn-press w-10 h-10 rounded-full text-lg font-bold text-white/70 bg-white/5 border border-white/10">−</button>
            <button onClick={() => changeWater(CUP_ML)}
              className="btn-press w-10 h-10 rounded-full text-lg font-bold text-white"
              style={{ background: COLOR }}>+</button>
          </div>
        </div>
        <div className="flex gap-1 mt-3">
          {Array.from({ length: goalCups }).map((_, i) => (
            <div key={i} className="flex-1 h-2 rounded-full transition-colors"
              style={{ background: i < cups ? COLOR : 'rgba(255,255,255,0.08)' }} />
          ))}
        </div>
      </Card>

      {/* Tap-to-add picker */}
      <div>
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Add Food</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search foods…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors mb-2"
        />
        <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
          {filtered.map((food, i) => {
            const q = qtyFor(food.name)
            return (
              <div key={food.name + i} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85 truncate">{food.name}</div>
                  <div className="text-[11px] text-white/40">
                    {food.cal} cal · {food.p}p {food.c}c {food.f}f{food.serving ? ` · ${food.serving}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => bumpQty(food.name, -1)}
                    className="btn-press w-7 h-7 rounded-lg text-white/60 bg-white/5 border border-white/10">−</button>
                  <span className="w-6 text-center text-sm font-bold text-white">{q}</span>
                  <button onClick={() => bumpQty(food.name, 1)}
                    className="btn-press w-7 h-7 rounded-lg text-white/60 bg-white/5 border border-white/10">+</button>
                  <button onClick={() => { addFood(food, q); setQtyMap((m) => ({ ...m, [food.name]: 1 })) }}
                    className="btn-press w-8 h-8 rounded-lg text-white font-bold ml-1"
                    style={{ background: COLOR }}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Logged items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Logged · {prettyDate(date)}</div>
          {items.length > 0 && (
            <button onClick={saveTemplate} className="btn-press text-[11px] font-bold" style={{ color: COLOR }}>
              Save as template
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <div className="text-3xl mb-2">🍽️</div>
            <p className="text-sm font-semibold">Nothing logged yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85 truncate">
                    {it.qty && it.qty !== 1 ? <span className="text-white/40">{it.qty}× </span> : null}{it.name}
                  </div>
                  <div className="text-[11px] text-white/40">{it.cal} cal · {it.p}p {it.c}c {it.f}f</div>
                </div>
                <button onClick={() => removeItem(i)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: `${COLOR}18` }}>
              <span className="text-sm font-black text-white">Total</span>
              <span className="text-sm font-black" style={{ color: COLOR }}>
                {totals.cal} cal · {totals.p}p {totals.c}c {totals.f}f
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ---- Modals ---- */}
      <Modal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode" accentColor={COLOR}>
        {showScanner && (
          <BarcodeScanner
            onFound={(food) => {
              addFood(food, 1)
              setShowScanner(false)
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </Modal>

      <Modal isOpen={showCustom} onClose={() => setShowCustom(false)} title="Add Custom Food" accentColor={COLOR}>
        <form onSubmit={handleAddCustom} className="space-y-3">
          <Field label="Name">
            <input value={customForm.name} onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="Mum's lasagne"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories">
              <input type="number" value={customForm.cal} onChange={(e) => setCustomForm((f) => ({ ...f, cal: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]" />
            </Field>
            <Field label="Protein (g)">
              <input type="number" value={customForm.p} onChange={(e) => setCustomForm((f) => ({ ...f, p: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]" />
            </Field>
            <Field label="Carbs (g)">
              <input type="number" value={customForm.c} onChange={(e) => setCustomForm((f) => ({ ...f, c: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]" />
            </Field>
            <Field label="Fat (g)">
              <input type="number" value={customForm.f} onChange={(e) => setCustomForm((f) => ({ ...f, f: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]" />
            </Field>
          </div>
          <Field label="Serving label">
            <input value={customForm.serving} onChange={(e) => setCustomForm((f) => ({ ...f, serving: e.target.value }))}
              placeholder="1 plate"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED]" />
          </Field>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Save Food
          </button>
        </form>
      </Modal>

      <Modal isOpen={showTemplates} onClose={() => setShowTemplates(false)} title="Meal Templates" accentColor={COLOR}>
        {(!templates || templates.length === 0) ? (
          <p className="text-sm text-white/50 py-4 text-center">
            No templates yet. Log a meal then tap “Save as template”.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => {
              const t = sumTotals(tpl.items)
              return (
                <div key={tpl.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white/85 truncate">{tpl.name}</div>
                    <div className="text-[11px] text-white/40">{(tpl.items || []).length} items · {t.cal} cal</div>
                  </div>
                  <button onClick={() => applyTemplate(tpl)}
                    className="btn-press px-3 py-2 rounded-lg text-sm font-bold text-white" style={{ background: COLOR }}>
                    Apply
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <TargetCalculatorModal
        isOpen={showTargets}
        onClose={() => setShowTargets(false)}
        profile={profile}
        onSave={saveTargets}
      />
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

function TargetCalculatorModal({ isOpen, onClose, profile, onSave }) {
  const [form, setForm] = useState({
    sex: 'male', age: '', heightCm: '', weightKg: '', activityLevel: 'moderate', goal: 'maintain',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        sex: profile.sex || 'male',
        age: profile.age || '',
        heightCm: profile.heightCm || '',
        weightKg: profile.weightKg || '',
        activityLevel: profile.activityLevel || 'moderate',
        goal: profile.goal || 'maintain',
      })
    }
  }, [profile, isOpen])

  const preview = useMemo(() => calcTargets({
    ...form,
    age: Number(form.age),
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
  }), [form])

  function submit(e) {
    e.preventDefault()
    onSave({
      sex: form.sex,
      age: Math.round(Number(form.age) || 0),
      heightCm: Math.round(Number(form.heightCm) || 0),
      weightKg: Math.round(Number(form.weightKg) || 0),
      activityLevel: form.activityLevel,
      goal: form.goal,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Target Calculator" accentColor={COLOR}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Sex">
          <div className="grid grid-cols-2 gap-2">
            {['male', 'female'].map((s) => (
              <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, sex: s }))}
                className="btn-press py-2.5 rounded-xl text-sm font-bold capitalize"
                style={{
                  background: form.sex === s ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                  color: form.sex === s ? COLOR : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${form.sex === s ? COLOR + '60' : 'transparent'}`,
                }}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Age">
            <input type="number" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              required className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-[#7C3AED]" />
          </Field>
          <Field label="Height cm">
            <input type="number" value={form.heightCm} onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
              required className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-[#7C3AED]" />
          </Field>
          <Field label="Weight kg">
            <input type="number" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
              required className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-[#7C3AED]" />
          </Field>
        </div>
        <Field label="Activity level">
          <select value={form.activityLevel} onChange={(e) => setForm((f) => ({ ...f, activityLevel: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#7C3AED]">
            {Object.keys(ACTIVITY_LEVELS).map((k) => (
              <option key={k} value={k} className="bg-black">{ACTIVITY_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Goal">
          <div className="grid grid-cols-3 gap-2">
            {['cut', 'maintain', 'bulk'].map((g) => (
              <button key={g} type="button" onClick={() => setForm((f) => ({ ...f, goal: g }))}
                className="btn-press py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: form.goal === g ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                  color: form.goal === g ? COLOR : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${form.goal === g ? COLOR + '60' : 'transparent'}`,
                }}>
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </Field>

        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">Calculated targets</div>
          <div className="text-sm font-bold" style={{ color: COLOR }}>
            {preview.calories} cal · {preview.protein}p {preview.carbs}c {preview.fat}f
          </div>
        </div>

        <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
          style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 30px ${COLOR}50` }}>
          Save Targets
        </button>
      </form>
    </Modal>
  )
}
