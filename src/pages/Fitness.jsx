import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
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

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'snack', label: 'Snack', icon: '🍿' },
]
const MEAL_KEYS = MEALS.map((m) => m.key)
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', other: 'Other' }
function defaultMeal() {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 18) return 'snack'
  return 'dinner'
}
const PORTIONS = [0.5, 1, 1.5, 2]

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
  const location = useLocation()
  const initialTab = ['food', 'train', 'progress'].includes(location.state?.tab)
    ? location.state.tab
    : 'food'
  const [tab, setTab] = useState(initialTab)

  // React to nav state changes when already mounted on /fitness.
  useEffect(() => {
    const t = location.state?.tab
    if (['food', 'train', 'progress'].includes(t)) setTab(t)
  }, [location.state])

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
  const {
    docs: recipes, fetchDocs: fetchRecipes, addDocument: addRecipe, deleteDocument: deleteRecipe,
  } = useFirestore('recipes')

  const [date, setDate] = useState(todayStr())
  const [selectedMeal, setSelectedMeal] = useState(defaultMeal())
  const [portionMap, setPortionMap] = useState({})
  const [editIdx, setEditIdx] = useState(null)
  const [showRecipes, setShowRecipes] = useState(false)
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
    fetchLogs(); fetchCustom(); fetchTemplates(); fetchProfile(); fetchRecipes()
  }, [fetchLogs, fetchCustom, fetchTemplates, fetchProfile, fetchRecipes])

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

  // Authoritative per-date {items, water} so rapid successive mutations chain
  // off the latest values rather than the render-closed `items`/`water`.
  const dayStateRef = useRef({})
  // Pending create promise keyed by date so a create for day A in flight never
  // gets patched with day B's items.
  const pendingCreateByDate = useRef({})

  useEffect(() => {
    // Only (re)seed from the server doc when no create is in flight for this
    // date — otherwise the optimistic ref state is the source of truth.
    if (pendingCreateByDate.current[date]) return
    dayStateRef.current[date] = {
      items: dayDoc?.items || [],
      water: Number(dayDoc?.water) || 0,
    }
  }, [dayDoc, date])

  const grouped = useMemo(() => {
    const g = { breakfast: [], lunch: [], dinner: [], snack: [], other: [] }
    items.forEach((it, idx) => {
      const key = MEAL_KEYS.includes(it.meal) ? it.meal : 'other'
      g[key].push({ it, idx })
    })
    return g
  }, [items])

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
  // Read the authoritative current state for a given day (falls back to the
  // render-closed values when the ref hasn't been seeded yet).
  function dayState(forDate) {
    const s = dayStateRef.current[forDate]
    if (s) return s
    return { items: forDate === date ? items : [], water: forDate === date ? water : 0 }
  }
  // Serializes writes for a specific day so two quick adds on a brand-new day
  // don't both create/PATCH — the second waits for the first create's real id.
  async function persistDay(nextItems, nextWater, forDate = date) {
    // Update the authoritative ref synchronously so chained mutations see it.
    dayStateRef.current[forDate] = { items: nextItems, water: nextWater }

    const existing = (foodLogs || []).find((d) => d.date === forDate)
    // Existing real doc — patch directly.
    if (existing && !String(existing.id).startsWith('temp_')) {
      await updateLog(existing.id, { items: nextItems, water: nextWater })
      return
    }
    // A create is already in flight for this day (optimistic temp doc present) —
    // wait for the real saved id, then update that instead of PATCHing temp_.
    if (pendingCreateByDate.current[forDate]) {
      const saved = await pendingCreateByDate.current[forDate]
      if (saved?.id) {
        await updateLog(saved.id, { items: nextItems, water: nextWater })
        return
      }
    }
    // No doc yet — create one and remember the in-flight promise for this date.
    const payload = { date: forDate, items: nextItems, water: nextWater }
    const p = addLog(payload)
    pendingCreateByDate.current[forDate] = p
    try {
      await p
    } finally {
      if (pendingCreateByDate.current[forDate] === p) delete pendingCreateByDate.current[forDate]
    }
  }
  async function addItems(newItems, meal = selectedMeal) {
    const m = MEAL_KEYS.includes(meal) ? meal : 'other'
    const cleaned = (newItems || []).map((it) => {
      const qty = Number(it.qty) || 1
      // Per-unit base macros so later qty edits rescale without rounding drift.
      const base = it.u && typeof it.u === 'object'
        ? it.u
        : {
            cal: (Number(it.cal) || 0) / qty,
            p: (Number(it.p) || 0) / qty,
            c: (Number(it.c) || 0) / qty,
            f: (Number(it.f) || 0) / qty,
          }
      return {
        name: String(it.name || 'Food'),
        cal: Math.round(Number(it.cal) || 0),
        p: Math.round(Number(it.p) || 0),
        c: Math.round(Number(it.c) || 0),
        f: Math.round(Number(it.f) || 0),
        qty,
        // Preserve an item's own valid meal (copy-yesterday / templates keep
        // their breakfast/lunch/dinner grouping); otherwise use the selection.
        meal: MEAL_KEYS.includes(it.meal) ? it.meal : m,
        u: { cal: base.cal, p: base.p, c: base.c, f: base.f },
      }
    })
    if (!cleaned.length) return
    const cur = dayState(date)
    await persistDay([...cur.items, ...cleaned], cur.water)
  }
  async function removeItem(idx) {
    const cur = dayState(date)
    await persistDay(cur.items.filter((_, i) => i !== idx), cur.water)
  }
  async function updateItem(idx, { qty, meal }) {
    const cur = dayState(date)
    const target = cur.items[idx]
    if (!target) return
    const newQty = Number(qty) || 1
    // Derive per-unit base once for legacy items that lack `u`.
    const base = target.u && typeof target.u === 'object'
      ? target.u
      : (() => {
          const oq = Number(target.qty) || 1
          return {
            cal: (Number(target.cal) || 0) / oq,
            p: (Number(target.p) || 0) / oq,
            c: (Number(target.c) || 0) / oq,
            f: (Number(target.f) || 0) / oq,
          }
        })()
    const next = cur.items.map((it, i) => (
      i === idx
        ? {
            ...it,
            qty: newQty,
            cal: Math.round(base.cal * newQty),
            p: Math.round(base.p * newQty),
            c: Math.round(base.c * newQty),
            f: Math.round(base.f * newQty),
            meal: MEAL_KEYS.includes(meal) ? meal : 'other',
            u: base,
          }
        : it
    ))
    await persistDay(next, cur.water)
  }
  async function changeWater(delta) {
    const cur = dayState(date)
    await persistDay(cur.items, Math.max(0, cur.water + delta))
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

  // ---- recipes ----
  function applyRecipe(rec) {
    if (rec?.items?.length) addItems(rec.items)
    setShowRecipes(false)
  }
  async function saveRecipe(rec) {
    if (!rec?.name || !rec.items?.length) return
    await addRecipe({ name: rec.name, items: rec.items, totals: rec.totals })
  }

  // ---- portion multiplier (tap-add picker) ----
  function portionFor(name) {
    return portionMap[name] || 1
  }
  function setPortion(name, mult) {
    setPortionMap((m) => ({ ...m, [name]: mult }))
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

      {/* Meal selector */}
      <div>
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Logging to</div>
        <div className="grid grid-cols-4 gap-2">
          {MEALS.map((m) => {
            const active = selectedMeal === m.key
            return (
              <button key={m.key} onClick={() => setSelectedMeal(m.key)}
                className="btn-press py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all"
                style={{
                  background: active ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                  color: active ? COLOR : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${active ? COLOR + '60' : 'transparent'}`,
                }}>
                <span className="text-base">{m.icon}</span>
                {m.label}
              </button>
            )
          })}
        </div>
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
        <button onClick={() => setShowRecipes(true)}
          className="btn-press col-span-2 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80">
          <span>📖</span> Recipes
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
            const portion = portionFor(food.name)
            const eff = q * portion
            return (
              <div key={food.name + i} className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white/85 truncate">{food.name}</div>
                    <div className="text-[11px] text-white/40">
                      {Math.round((Number(food.cal) || 0) * eff)} cal · {Math.round((Number(food.p) || 0) * eff)}p {Math.round((Number(food.c) || 0) * eff)}c {Math.round((Number(food.f) || 0) * eff)}f{food.serving ? ` · ${food.serving}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => bumpQty(food.name, -1)}
                      className="btn-press w-7 h-7 rounded-lg text-white/60 bg-white/5 border border-white/10">−</button>
                    <span className="w-6 text-center text-sm font-bold text-white">{q}</span>
                    <button onClick={() => bumpQty(food.name, 1)}
                      className="btn-press w-7 h-7 rounded-lg text-white/60 bg-white/5 border border-white/10">+</button>
                    <button onClick={() => { addFood(food, eff); setQtyMap((m) => ({ ...m, [food.name]: 1 })); setPortion(food.name, 1) }}
                      className="btn-press w-8 h-8 rounded-lg text-white font-bold ml-1"
                      style={{ background: COLOR }}>+</button>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {PORTIONS.map((mult) => {
                    const on = portion === mult
                    return (
                      <button key={mult} onClick={() => setPortion(food.name, mult)}
                        className="btn-press flex-1 py-1 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                          background: on ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                          color: on ? COLOR : 'rgba(255,255,255,0.45)',
                          border: `1px solid ${on ? COLOR + '55' : 'transparent'}`,
                        }}>
                        {mult}×
                      </button>
                    )
                  })}
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
          <div className="space-y-4">
            {['breakfast', 'lunch', 'dinner', 'snack', 'other'].map((mk) => {
              const rows = grouped[mk]
              if (!rows.length) return null
              const sub = sumTotals(rows.map((r) => r.it))
              return (
                <div key={mk}>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: COLOR }}>{MEAL_LABEL[mk]}</span>
                    <span className="text-[11px] font-bold text-white/40">{sub.cal} cal</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map(({ it, idx }) => (
                      <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <button onClick={() => setEditIdx(idx)} className="flex-1 min-w-0 text-left btn-press">
                          <div className="text-sm font-bold text-white/85 truncate">
                            {it.qty && it.qty !== 1 ? <span className="text-white/40">{it.qty}× </span> : null}{it.name}
                          </div>
                          <div className="text-[11px] text-white/40">{it.cal} cal · {it.p}p {it.c}c {it.f}f</div>
                        </button>
                        <button onClick={() => removeItem(idx)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
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

      <RecipesModal
        isOpen={showRecipes}
        onClose={() => setShowRecipes(false)}
        recipes={recipes}
        allFoods={allFoods}
        mealLabel={MEAL_LABEL[selectedMeal] || 'Other'}
        onApply={applyRecipe}
        onSave={saveRecipe}
        onDelete={deleteRecipe}
      />

      <EditItemModal
        isOpen={editIdx != null}
        item={editIdx != null ? items[editIdx] : null}
        onClose={() => setEditIdx(null)}
        onSave={async (payload) => { await updateItem(editIdx, payload); setEditIdx(null) }}
        onDelete={async () => { await removeItem(editIdx); setEditIdx(null) }}
      />

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

function EditItemModal({ isOpen, item, onClose, onSave, onDelete }) {
  const [qty, setQty] = useState(1)
  const [meal, setMeal] = useState('other')

  useEffect(() => {
    if (item) {
      setQty(Number(item.qty) || 1)
      setMeal(MEAL_KEYS.includes(item.meal) ? item.meal : 'other')
    }
  }, [item])

  if (!item) return null
  const oldQty = Number(item.qty) || 1
  const r = oldQty > 0 ? qty / oldQty : 1
  const preview = {
    cal: Math.round((Number(item.cal) || 0) * r),
    p: Math.round((Number(item.p) || 0) * r),
    c: Math.round((Number(item.c) || 0) * r),
    f: Math.round((Number(item.f) || 0) * r),
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit item" accentColor={COLOR}>
      <div className="space-y-4">
        <div className="text-sm font-bold text-white/85">{item.name}</div>

        <Field label="Quantity">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setQty((q) => Math.max(0.25, Math.round((q - 0.25) * 100) / 100))}
              className="btn-press w-11 h-11 rounded-xl text-lg font-bold text-white/70 bg-white/5 border border-white/10">−</button>
            <span className="flex-1 text-center text-xl font-black text-white">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.round((q + 0.25) * 100) / 100)}
              className="btn-press w-11 h-11 rounded-xl text-lg font-bold text-white" style={{ background: COLOR }}>+</button>
          </div>
        </Field>

        <Field label="Meal">
          <div className="grid grid-cols-4 gap-2">
            {MEALS.map((m) => {
              const on = meal === m.key
              return (
                <button key={m.key} type="button" onClick={() => setMeal(m.key)}
                  className="btn-press py-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-0.5"
                  style={{
                    background: on ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                    color: on ? COLOR : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${on ? COLOR + '60' : 'transparent'}`,
                  }}>
                  <span className="text-base">{m.icon}</span>{m.label}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">New macros</div>
          <div className="text-sm font-bold" style={{ color: COLOR }}>
            {preview.cal} cal · {preview.p}p {preview.c}c {preview.f}f
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onDelete}
            className="btn-press flex-1 py-3 rounded-xl font-bold text-sm text-red-400 bg-red-500/10 border border-red-500/20">
            Delete
          </button>
          <button type="button" onClick={() => onSave({ qty, meal })}
            className="btn-press flex-1 py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RecipesModal({ isOpen, onClose, recipes, allFoods, mealLabel, onApply, onSave, onDelete }) {
  const [building, setBuilding] = useState(false)
  const [name, setName] = useState('')
  const [rItems, setRItems] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) { setBuilding(false); setName(''); setRItems([]); setSearch('') }
  }, [isOpen])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allFoods.slice(0, 20)
    return allFoods.filter((food) => {
      if (String(food.name).toLowerCase().includes(q)) return true
      return (food.aliases || []).some((a) => String(a).toLowerCase().includes(q))
    }).slice(0, 30)
  }, [search, allFoods])

  const rTotals = useMemo(() => sumTotals(rItems), [rItems])

  function addBuilderFood(food) {
    setRItems((prev) => [...prev, {
      name: food.name,
      cal: Math.round(Number(food.cal) || 0),
      p: Math.round(Number(food.p) || 0),
      c: Math.round(Number(food.c) || 0),
      f: Math.round(Number(food.f) || 0),
      qty: 1,
    }])
  }
  function save() {
    if (!name.trim() || !rItems.length) return
    onSave({ name: name.trim(), items: rItems, totals: rTotals })
    setBuilding(false); setName(''); setRItems([]); setSearch('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recipes" accentColor={COLOR}>
      {!building ? (
        <div className="space-y-3">
          <button onClick={() => setBuilding(true)}
            className="btn-press w-full py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
            + Build new recipe
          </button>
          {(!recipes || recipes.length === 0) ? (
            <p className="text-sm text-white/50 py-4 text-center">No recipes yet. Build one to reuse a set of foods in one tap.</p>
          ) : (
            <div className="space-y-2">
              {recipes.map((rec) => {
                const t = rec.totals || sumTotals(rec.items)
                return (
                  <div key={rec.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white/85 truncate">{rec.name}</div>
                      <div className="text-[11px] text-white/40">{(rec.items || []).length} items · {t.cal} cal</div>
                    </div>
                    <button onClick={() => onDelete(rec.id)}
                      className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 px-1">✕</button>
                    <button onClick={() => onApply(rec)}
                      className="btn-press px-3 py-2 rounded-lg text-sm font-bold text-white" style={{ background: COLOR }}>
                      Add to {mealLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Recipe name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicken & rice bowl"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED]" />
          </Field>

          {rItems.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.04] border border-white/10">
              {rItems.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-white/80 truncate">{it.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-white/40 text-xs">{it.cal} cal</span>
                    <button onClick={() => setRItems((prev) => prev.filter((_, x) => x !== i))}
                      className="text-white/20 hover:text-red-400">✕</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/10 text-sm">
                <span className="font-bold text-white">Total</span>
                <span className="font-bold" style={{ color: COLOR }}>{rTotals.cal} cal · {rTotals.p}p {rTotals.c}c {rTotals.f}f</span>
              </div>
            </div>
          )}

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search foods to add…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED]" />
          <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
            {filtered.map((food, i) => (
              <button key={food.name + i} onClick={() => addBuilderFood(food)}
                className="btn-press w-full flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10 text-left">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85 truncate">{food.name}</div>
                  <div className="text-[11px] text-white/40">{food.cal} cal · {food.p}p {food.c}c {food.f}f</div>
                </div>
                <span className="text-lg font-bold flex-shrink-0" style={{ color: COLOR }}>+</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setBuilding(false)}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-semibold text-white/50 bg-white/5 border border-white/10">
              Cancel
            </button>
            <button onClick={save} disabled={!name.trim() || !rItems.length}
              className="btn-press flex-1 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
              Save recipe
            </button>
          </div>
        </div>
      )}
    </Modal>
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
