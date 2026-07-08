// Pure, defensive food-text parsing helpers. None of these ever throw.

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  couple: 2, dozen: 12, half: 0.5,
}

// Rough size multipliers applied on top of an explicit count.
const SIZE_MULTIPLIERS = {
  big: 1.5,
  large: 1.5,
  huge: 1.5,
  massive: 1.5,
  small: 0.75,
  little: 0.75,
  mini: 0.75,
}

const round = (n) => Math.round(n)

function safeStr(x) {
  return (x == null ? '' : String(x)).toLowerCase()
}

/**
 * parseInlineMacros("Protein oats 350 cal 30g protein 40g carbs 8g fat")
 *   -> { name: "Protein oats", cal: 350, p: 30, c: 40, f: 8 }
 * Returns null when no explicit macro token is present.
 * Accepts any subset, order-insensitive. Units: cal/kcal/calories, protein/p, carbs/carb/c, fat/f.
 */
export function parseInlineMacros(text) {
  try {
    if (!text || typeof text !== 'string') return null
    const lower = text.toLowerCase()

    // Regexes for each macro. Number may precede or follow the unit word.
    const calRe = /(\d+(?:\.\d+)?)\s*(?:kcal|cals?|calories)\b/
    const proRe = /(\d+(?:\.\d+)?)\s*g?\s*(?:protein|prot|\bp\b)/
    const carbRe = /(\d+(?:\.\d+)?)\s*g?\s*(?:carbs?|carbohydrates?|\bc\b)/
    const fatRe = /(\d+(?:\.\d+)?)\s*g?\s*(?:fat|\bf\b)/

    const calM = lower.match(calRe)
    const proM = lower.match(proRe)
    const carbM = lower.match(carbRe)
    const fatM = lower.match(fatRe)

    // Require at least one explicit macro token to treat this as inline macros.
    if (!calM && !proM && !carbM && !fatM) return null

    const cal = calM ? round(parseFloat(calM[1])) : 0
    const p = proM ? round(parseFloat(proM[1])) : 0
    const c = carbM ? round(parseFloat(carbM[1])) : 0
    const f = fatM ? round(parseFloat(fatM[1])) : 0

    // Name = leading words before the first macro token / first standalone number.
    const firstNumberIdx = lower.search(/\d/)
    let name = firstNumberIdx > 0 ? text.slice(0, firstNumberIdx) : ''
    name = name.replace(/[,;:-]+$/, '').trim()
    if (!name) name = 'Custom food'

    return { name, cal, p, c, f }
  } catch (e) {
    return null
  }
}

// Build a searchable list of { key, food } from name + aliases.
function buildIndex(foods) {
  const index = []
  for (const food of foods || []) {
    if (!food || !food.name) continue
    const keys = [safeStr(food.name), ...(Array.isArray(food.aliases) ? food.aliases.map(safeStr) : [])]
    for (const key of keys) {
      const k = key.trim()
      if (k) index.push({ key: k, food })
    }
  }
  // Longer keys first so longest-match wins when starts tie.
  index.sort((a, b) => b.key.length - a.key.length)
  return index
}

function applyQty(food, qty) {
  const q = qty || 1
  return {
    name: food.name,
    cal: round((Number(food.cal) || 0) * q),
    p: round((Number(food.p) || 0) * q),
    c: round((Number(food.c) || 0) * q),
    f: round((Number(food.f) || 0) * q),
    qty: q,
  }
}

// Look backwards from a match start for a quantity / size multiplier.
// Returns { qty, consumedFrom } where consumedFrom is the char index the
// quantity words began at (so they aren't reported as "unmatched").
function detectQty(text, matchStart) {
  const before = text.slice(0, matchStart)
  // up to two preceding words
  const words = before.trim().split(/\s+/).filter(Boolean)
  let qty = 1
  let usedWords = 0
  let sizeApplied = false
  let countApplied = false

  for (let i = words.length - 1; i >= 0 && usedWords < 2; i--) {
    const w = words[i].replace(/[^a-z0-9.]/g, '')
    if (!w) break
    if (!countApplied && /^\d+(\.\d+)?$/.test(w)) {
      qty *= parseFloat(w)
      countApplied = true
      usedWords++
      continue
    }
    if (!countApplied && NUMBER_WORDS[w] != null) {
      qty *= NUMBER_WORDS[w]
      countApplied = true
      usedWords++
      continue
    }
    if (!sizeApplied && SIZE_MULTIPLIERS[w] != null) {
      qty *= SIZE_MULTIPLIERS[w]
      sizeApplied = true
      usedWords++
      continue
    }
    break
  }

  // Compute the char index where consumed words begin.
  let consumedFrom = matchStart
  if (usedWords > 0) {
    // Re-locate the start of the last `usedWords` words within `before`.
    const trimmedEnd = before.replace(/\s+$/, '')
    const allWords = trimmedEnd.split(/(\s+)/) // keep separators
    // Walk from the end counting non-space tokens.
    let count = 0
    let idx = trimmedEnd.length
    for (let i = allWords.length - 1; i >= 0; i--) {
      const tok = allWords[i]
      idx -= tok.length
      if (tok.trim()) {
        count++
        if (count === usedWords) {
          consumedFrom = idx
          break
        }
      }
    }
  }

  if (!qty || qty <= 0 || Number.isNaN(qty)) qty = 1
  return { qty: Math.round(qty * 100) / 100, consumedFrom }
}

/**
 * parseFoodText(text, foods)
 * Greedy longest-match left-to-right over run-on natural language.
 * Earliest start wins; for equal starts the longest match wins.
 * Supports a leading quantity ("two", "3", "big", "small") applied to each item.
 *
 * Returns { items:[{name,cal,p,c,f,qty}], totals:{cal,p,c,f}, unmatched:[words] }
 */
export function parseFoodText(text, foods) {
  const empty = { items: [], totals: { cal: 0, p: 0, c: 0, f: 0 }, unmatched: [] }
  try {
    if (!text || typeof text !== 'string') return empty
    const lower = text.toLowerCase()
    const index = buildIndex(foods)

    // Collect every candidate occurrence of every key.
    const candidates = []
    for (const { key, food } of index) {
      let from = 0
      while (from <= lower.length) {
        const at = lower.indexOf(key, from)
        if (at === -1) break
        // Word-boundary-ish check so "pie" doesn't match inside "pieces".
        const before = at === 0 ? ' ' : lower[at - 1]
        const afterIdx = at + key.length
        const after = afterIdx >= lower.length ? ' ' : lower[afterIdx]
        const boundaryOk = /[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after)
        if (boundaryOk) {
          candidates.push({ start: at, end: afterIdx, key, food })
        }
        from = at + 1
      }
    }

    // Earliest start first; for ties, longest match first.
    candidates.sort((a, b) => (a.start - b.start) || (b.end - a.end) || (b.key.length - a.key.length))

    const items = []
    const covered = [] // array of [start,end] intervals consumed (incl. qty words)
    const overlaps = (s, e) => covered.some(([cs, ce]) => s < ce && e > cs)

    for (const cand of candidates) {
      if (overlaps(cand.start, cand.end)) continue
      const { qty, consumedFrom } = detectQty(text, cand.start)
      // Ensure qty words we consume don't overlap something already taken.
      const startCover = overlaps(consumedFrom, cand.start) ? cand.start : consumedFrom
      items.push(applyQty(cand.food, qty))
      covered.push([startCover, cand.end])
    }

    // Keep items in reading order.
    // (candidates already earliest-first, so items are in order.)

    // Determine unmatched words: any token not inside a covered interval.
    const unmatched = []
    const IGNORE = new Set([
      'of', 'a', 'an', 'the', 'and', 'with', 'plus', 'some', 'bowl', 'plate',
      'cup', 'glass', 'serve', 'serving', 'big', 'large', 'small', 'little',
      'mini', 'huge', 'massive', 'couple', 'half', 'dozen', 'my', 'then',
      'had', 'ate', 'for', 'to', 'in', 'on', 'as', 'i',
    ])
    const wordRe = /[a-z0-9']+/g
    let m
    while ((m = wordRe.exec(lower)) !== null) {
      const wStart = m.index
      const wEnd = wStart + m[0].length
      const inCovered = covered.some(([cs, ce]) => wStart >= cs && wEnd <= ce)
      if (inCovered) continue
      if (NUMBER_WORDS[m[0]] != null) continue
      if (/^\d+(\.\d+)?$/.test(m[0])) continue
      if (IGNORE.has(m[0])) continue
      unmatched.push(m[0])
    }

    const totals = items.reduce(
      (acc, it) => ({
        cal: acc.cal + (it.cal || 0),
        p: acc.p + (it.p || 0),
        c: acc.c + (it.c || 0),
        f: acc.f + (it.f || 0),
      }),
      { cal: 0, p: 0, c: 0, f: 0 }
    )

    return { items, totals, unmatched }
  } catch (e) {
    return empty
  }
}

/*
 * ---- Unit tests (illustrative, expected behaviour) ----
 *
 * Example input:
 *   "big bowl of just right with milk peanut butter sandwich chocolate milk carbonara steak sandwich and a protein shake"
 *
 * Expected matched items (greedy longest-match, left-to-right, non-overlapping):
 *   - "Just Right Cereal" x1.5   (leading "big" => x1.5 size multiplier)
 *   - "Full Cream Milk" x1       (matched via alias "milk")
 *   - "Peanut Butter Sandwich" x1 (longer match beats "Peanut Butter" + "Sandwich")
 *   - "Chocolate Milk" x1        (matched before a second bare "milk")
 *   - "Carbonara" x1
 *   - "Steak Sandwich" x1
 *   - "Protein Shake" x1         ("a" is ignored, not counted as qty on shake)
 *   totals = sum of the above item macros
 *   unmatched = []  ("bowl","of","with","and","a" are all ignored words)
 *
 * parseInlineMacros("Mystery meal 200 cal 20g protein 20g carbs 7g fat")
 *   => { name: "Mystery meal", cal: 200, p: 20, c: 20, f: 7 }
 * parseInlineMacros("300 kcal 25 protein")
 *   => { name: "Custom food", cal: 300, p: 25, c: 0, f: 0 }
 * parseInlineMacros("just a banana")            => null (no macro tokens)
 * parseFoodText("two eggs and toast", FOODS)    => eggs qty 2, plus toast; totals summed
 * parseFoodText("", FOODS)                       => { items:[], totals:{...0}, unmatched:[] }
 */
