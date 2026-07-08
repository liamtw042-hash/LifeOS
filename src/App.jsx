import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import LoadingSpinner from './components/LoadingSpinner'
import { useFirestore } from './hooks/useFirestore'
import { startScheduler, defaultReminders } from './lib/reminders'

// Code-split the page routes so the initial bundle stays small.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Fitness = lazy(() => import('./pages/Fitness'))
const Review = lazy(() => import('./pages/Review'))
const Journal = lazy(() => import('./pages/Journal'))
const School = lazy(() => import('./pages/School'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Wellness = lazy(() => import('./pages/Wellness'))
const Settings = lazy(() => import('./pages/Settings'))
const Onboarding = lazy(() => import('./pages/Onboarding'))

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <LoadingSpinner color="#7C3AED" size={40} />
    </div>
  )
}

// Runs the reminder scheduler while logged in, reading the latest settings doc.
function useReminderScheduler() {
  const { docs: settingsDocs, fetchDocs } = useFirestore('settings')
  const remindersRef = useRef(defaultReminders())

  useEffect(() => { fetchDocs() }, [fetchDocs])

  useEffect(() => {
    const doc = (settingsDocs || [])[0]
    remindersRef.current = { ...defaultReminders(), ...(doc?.reminders || {}) }
  }, [settingsDocs])

  useEffect(() => {
    const stop = startScheduler(() => remindersRef.current)
    return stop
  }, [])
}

function AppRoutes() {
  return (
    <Layout>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fitness" element={<Fitness />} />
          <Route path="/review" element={<Review />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/school" element={<School />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/wellness" element={<Wellness />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

// Decides between first-run onboarding and the app. A user is "brand new"
// only when they have no fitnessProfile doc AND no settings doc.
function OnboardingGate() {
  const { docs: profiles, fetchDocs: fetchProfiles } = useFirestore('fitnessProfile')
  const { docs: settings, fetchDocs: fetchSettings } = useFirestore('settings')
  const [ready, setReady] = useState(false)
  const [completed, setCompleted] = useState(false)
  const fetchOkRef = useRef(false)

  useEffect(() => {
    let alive = true
    Promise.all([fetchProfiles(), fetchSettings()])
      .then(([okP, okS]) => { if (alive) fetchOkRef.current = !!(okP && okS) })
      .catch(() => { if (alive) fetchOkRef.current = false })
      .finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [fetchProfiles, fetchSettings])

  if (!ready) return <FullScreenLoader />

  // Only treat as brand-new when BOTH fetches succeeded AND both are empty.
  // On any fetch failure, fail open to the app (never force onboarding).
  const brandNew = fetchOkRef.current
    && (profiles?.length || 0) === 0
    && (settings?.length || 0) === 0
  if (brandNew && !completed) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <Onboarding onDone={() => setCompleted(true)} />
      </Suspense>
    )
  }

  return <AppRoutes />
}

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  useReminderScheduler()

  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/auth" replace />

  return <OnboardingGate />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthGate />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to="/" replace />
  return <Auth />
}
