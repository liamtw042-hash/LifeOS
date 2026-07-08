// Full-account data export / import over the Firestore REST helpers.
import { queryDocs, addDoc } from '../firestoreRest'

export const APP_COLLECTIONS = [
  'foodLog',
  'customFoods',
  'mealTemplates',
  'fitnessProfile',
  'workoutSessions',
  'weights',
  'journal',
  'assignments',
  'habits',
  'goals',
  'dailyGoals',
  'progressPhotos',
  'settings',
]

const EXPORT_VERSION = 1

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Read every app collection for the user and trigger a JSON download.
export async function exportAllData({ getIdToken, uid }) {
  const token = await getIdToken()
  const collections = {}
  for (const name of APP_COLLECTIONS) {
    try {
      const docs = await queryDocs(name, uid, token)
      collections[name] = docs || []
    } catch (e) {
      // Missing/empty collection or a per-collection error — keep going.
      collections[name] = []
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    collections,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `lifeos-backup-${localDateKey()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // Revoke on next tick so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const total = Object.values(collections).reduce((n, arr) => n + arr.length, 0)
  return { total, collections: Object.keys(collections).length }
}

// ---- CSV export ---------------------------------------------------------

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) lines.push(row.map(csvEscape).join(','))
  return lines.join('\r\n')
}

function downloadBlob(text, filename, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

const sumField = (items, key) =>
  (Array.isArray(items) ? items : []).reduce((n, it) => n + (Number(it && it[key]) || 0), 0)

// Export readable CSV files for the tabular collections. Triggers one download
// per non-empty dataset (weights, daily nutrition totals, workout sessions).
export async function exportCsv({ getIdToken, uid }) {
  const token = await getIdToken()

  const safeQuery = async (name) => {
    try { return (await queryDocs(name, uid, token)) || [] } catch { return [] }
  }

  const [weights, foodLog, sessions] = await Promise.all([
    safeQuery('weights'),
    safeQuery('foodLog'),
    safeQuery('workoutSessions'),
  ])

  const stamp = localDateKey()
  const files = []

  // Weights: date, value
  const weightRows = [...weights]
    .filter((w) => w && w.date != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((w) => [w.date, Number(w.value) || 0])
  files.push({
    name: `lifeos-weights-${stamp}.csv`,
    text: toCsv(['date', 'value'], weightRows),
    rows: weightRows.length,
  })

  // Daily nutrition totals computed from each foodLog day doc.
  const nutritionRows = [...foodLog]
    .filter((d) => d && d.date != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((d) => [
      d.date,
      Math.round(sumField(d.items, 'cal')),
      Math.round(sumField(d.items, 'p')),
      Math.round(sumField(d.items, 'c')),
      Math.round(sumField(d.items, 'f')),
      Math.round(Number(d.water) || 0),
    ])
  files.push({
    name: `lifeos-nutrition-${stamp}.csv`,
    text: toCsv(['date', 'calories', 'protein', 'carbs', 'fat', 'water'], nutritionRows),
    rows: nutritionRows.length,
  })

  // Workout sessions: date, day, durationMin, volume, prsCount
  const sessionRows = [...sessions]
    .filter((s) => s && s.date != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((s) => [
      s.date,
      s.day || '',
      Math.round(Number(s.durationMin) || 0),
      Math.round(Number(s.volume) || 0),
      Array.isArray(s.prs) ? s.prs.length : 0,
    ])
  files.push({
    name: `lifeos-workouts-${stamp}.csv`,
    text: toCsv(['date', 'day', 'durationMin', 'volume', 'prsCount'], sessionRows),
    rows: sessionRows.length,
  })

  // Trigger a download for each file (stagger slightly for browser reliability).
  let downloaded = 0
  for (const f of files) {
    downloadBlob(f.text, f.name)
    downloaded++
    await new Promise((r) => setTimeout(r, 250))
  }

  const totalRows = files.reduce((n, f) => n + f.rows, 0)
  return { files: downloaded, rows: totalRows }
}

// Additive import: adds every doc from the backup to the user's collections.
// Never deletes. Returns a summary { added, skipped, errors }.
export async function importAllData(json, { getIdToken, uid }) {
  const summary = { added: 0, skipped: 0, errors: 0 }

  let data = json
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json)
    } catch (e) {
      throw new Error('Invalid backup file: could not parse JSON.')
    }
  }

  if (!data || typeof data !== 'object' || !data.collections || typeof data.collections !== 'object') {
    throw new Error('Invalid backup file: missing "collections".')
  }

  const token = await getIdToken()

  for (const [name, docs] of Object.entries(data.collections)) {
    if (!APP_COLLECTIONS.includes(name)) {
      // Unknown collection — skip every doc in it.
      summary.skipped += Array.isArray(docs) ? docs.length : 0
      continue
    }
    if (!Array.isArray(docs)) continue

    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') {
        summary.skipped++
        continue
      }
      // Strip id; force ownership to the importing user.
      const { id, userId, ...rest } = doc
      try {
        await addDoc(name, { ...rest, userId: uid }, token)
        summary.added++
      } catch (e) {
        summary.errors++
      }
    }
  }

  return summary
}
