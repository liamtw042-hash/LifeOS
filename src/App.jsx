import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Fitness from './pages/Fitness'
import Journal from './pages/Journal'
import School from './pages/School'
import LoadingSpinner from './components/LoadingSpinner'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <LoadingSpinner color="#7C3AED" size={40} />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/fitness" element={<Fitness />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/school" element={<School />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
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
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <LoadingSpinner color="#7C3AED" size={40} />
      </div>
    )
  }
  if (user) return <Navigate to="/" replace />
  return <Auth />
}
