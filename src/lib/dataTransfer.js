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
