import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as fs from '../firestoreRest'

export function useFirestore(collection) {
  const { user, getIdToken } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDocs = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const token = await getIdToken()
      const data = await fs.queryDocs(collection, user.uid, token)
      setDocs(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [collection, user, getIdToken])

  const addDocument = useCallback(async (data) => {
    if (!user) return null
    const newDoc = {
      ...data,
      userId: user.uid,
      createdAt: new Date().toISOString(),
    }
    // Optimistic update
    const tempId = 'temp_' + Date.now()
    setDocs((prev) => [{ id: tempId, ...newDoc }, ...prev])
    try {
      const token = await getIdToken()
      const saved = await fs.addDoc(collection, newDoc, token)
      setDocs((prev) => prev.map((d) => (d.id === tempId ? saved : d)))
      return saved
    } catch (e) {
      setDocs((prev) => prev.filter((d) => d.id !== tempId))
      setError(e.message)
      return null
    }
  }, [collection, user, getIdToken])

  const updateDocument = useCallback(async (docId, data) => {
    // Optimistic update
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, ...data } : d)))
    try {
      const token = await getIdToken()
      await fs.updateDoc(collection, docId, data, token)
    } catch (e) {
      setError(e.message)
      // Revert on error - re-fetch from server to resync
      try { fetchDocs() } catch (_) { /* ignore */ }
    }
  }, [collection, getIdToken, fetchDocs])

  const deleteDocument = useCallback(async (docId) => {
    // Optimistic update
    setDocs((prev) => prev.filter((d) => d.id !== docId))
    try {
      const token = await getIdToken()
      await fs.deleteDoc(collection, docId, token)
    } catch (e) {
      setError(e.message)
    }
  }, [collection, getIdToken])

  return {
    docs,
    setDocs,
    loading,
    error,
    fetchDocs,
    addDocument,
    updateDocument,
    deleteDocument,
  }
}
