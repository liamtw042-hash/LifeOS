import { useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as fs from '../firestoreRest'

export function useFirestore(collection) {
  const { user, getIdToken } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pendingCreatesRef = useRef(new Map())

  const fetchDocs = useCallback(async () => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      const token = await getIdToken()
      const data = await fs.queryDocs(collection, user.uid, token)
      setDocs(data)
      return true
    } catch (e) {
      setError(e.message)
      return false
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
    const createPromise = (async () => {
      const token = await getIdToken()
      const saved = await fs.addDoc(collection, newDoc, token)
      setDocs((prev) => prev.map((d) => (d.id === tempId ? saved : d)))
      return saved
    })()
    pendingCreatesRef.current.set(tempId, createPromise)
    try {
      const saved = await createPromise
      return saved
    } catch (e) {
      setDocs((prev) => prev.filter((d) => d.id !== tempId))
      setError(e.message)
      return null
    } finally {
      pendingCreatesRef.current.delete(tempId)
    }
  }, [collection, user, getIdToken])

  const updateDocument = useCallback(async (docId, data) => {
    // Optimistic update
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, ...data } : d)))
    try {
      const token = await getIdToken()
      let realId = docId
      // If this doc is still an in-flight optimistic create, wait for its
      // real id before patching so we don't PATCH a temp_ id (404).
      if (String(docId).startsWith('temp_') && pendingCreatesRef.current.has(docId)) {
        const saved = await pendingCreatesRef.current.get(docId)
        realId = saved.id
        // Re-apply the optimistic update to the real id too.
        setDocs((prev) => prev.map((d) => (d.id === realId ? { ...d, ...data } : d)))
      }
      await fs.updateDoc(collection, realId, data, token)
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
      let realId = docId
      if (String(docId).startsWith('temp_') && pendingCreatesRef.current.has(docId)) {
        const saved = await pendingCreatesRef.current.get(docId)
        realId = saved.id
      }
      await fs.deleteDoc(collection, realId, token)
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
