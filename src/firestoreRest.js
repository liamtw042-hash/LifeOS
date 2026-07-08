const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// Convert JS value to Firestore REST API field value
function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) }
    return { doubleValue: value }
  }
  if (typeof value === 'string') {
    // Check if it looks like an ISO date
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { timestampValue: value }
    return { stringValue: value }
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    }
  }
  if (typeof value === 'object') {
    const fields = {}
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(value) }
}

// Convert Firestore REST field value to JS value
function fromFirestoreValue(val) {
  if ('nullValue' in val) return null
  if ('booleanValue' in val) return val.booleanValue
  if ('integerValue' in val) return parseInt(val.integerValue, 10)
  if ('doubleValue' in val) return val.doubleValue
  if ('stringValue' in val) return val.stringValue
  if ('timestampValue' in val) return val.timestampValue
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue)
  }
  if ('mapValue' in val) {
    return fromFirestoreFields(val.mapValue.fields || {})
  }
  return null
}

function fromFirestoreFields(fields) {
  if (!fields) return {}
  const result = {}
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v)
  }
  return result
}

function docToObject(doc) {
  if (!doc || !doc.name) return null
  const id = doc.name.split('/').pop()
  return {
    id,
    ...fromFirestoreFields(doc.fields || {}),
  }
}

function objectToFields(data) {
  const fields = {}
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v)
  }
  return fields
}

// Get all documents in a collection for current user
export async function getDocs(collection, userId, idToken) {
  const url = `${BASE_URL}/${collection}?pageSize=200`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!res.ok) throw new Error(`getDocs failed: ${res.status}`)
  const data = await res.json()
  const docs = (data.documents || []).map(docToObject).filter(Boolean)
  return docs.filter((d) => d.userId === userId)
}

// Add a document
export async function addDoc(collection, data, idToken) {
  const url = `${BASE_URL}/${collection}`
  const body = { fields: objectToFields(data) }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`addDoc failed: ${res.status}`)
  const doc = await res.json()
  return docToObject(doc)
}

// Update a document
export async function updateDoc(collection, docId, data, idToken) {
  const fields = objectToFields(data)
  const updateMask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&')
  const url = `${BASE_URL}/${collection}/${docId}?${updateMask}`
  const body = { fields }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`updateDoc failed: ${res.status}`)
  const doc = await res.json()
  return docToObject(doc)
}

// Delete a document
export async function deleteDoc(collection, docId, idToken) {
  const url = `${BASE_URL}/${collection}/${docId}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!res.ok) throw new Error(`deleteDoc failed: ${res.status}`)
  return true
}

// Query documents where userId == uid
export async function queryDocs(collection, userId, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: userId },
        },
      },
      limit: 200,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`queryDocs failed: ${res.status}`)
  const results = await res.json()
  return results
    .filter((r) => r.document)
    .map((r) => docToObject(r.document))
    .filter(Boolean)
}
