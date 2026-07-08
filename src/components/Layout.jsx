import React from 'react'
import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import GradientBackground from './GradientBackground'
import QuickAdd from './QuickAdd'

const SECTION_MAP = {
  '/': 'dashboard',
  '/fitness': 'fitness',
  '/journal': 'journal',
  '/school': 'school',
}

export default function Layout({ children }) {
  const location = useLocation()
  const section = SECTION_MAP[location.pathname] || 'dashboard'

  return (
    <div className="relative min-h-screen bg-black" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <GradientBackground section={section} />
      <div className="relative z-10">
        {children}
      </div>
      <QuickAdd />
      <BottomNav />
    </div>
  )
}
