import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🏠', color: '#7C3AED' },
  { path: '/goals', label: 'Goals', icon: '🎯', color: '#7C3AED' },
  { path: '/habits', label: 'Habits', icon: '✅', color: '#06B6D4' },
  { path: '/money', label: 'Money', icon: '💰', color: '#10B981' },
  { path: '/fitness', label: 'Fit', icon: '💪', color: '#7C3AED' },
  { path: '/projects', label: 'Work', icon: '📋', color: '#EC4899' },
  { path: '/journal', label: 'Notes', icon: '📓', color: '#EAB308' },
  { path: '/school', label: 'School', icon: '🎓', color: '#3B82F6' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 btn-press min-w-0"
              style={{
                color: isActive ? item.color : 'rgba(255,255,255,0.4)',
                textShadow: isActive ? `0 0 12px ${item.color}` : 'none',
              }}
            >
              <span className="text-lg leading-none" style={{ filter: isActive ? `drop-shadow(0 0 6px ${item.color})` : 'none' }}>
                {item.icon}
              </span>
              <span className="text-[9px] font-semibold tracking-wide leading-none truncate" style={{ maxWidth: 36 }}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
