import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '🏠', color: '#7C3AED' },
  { path: '/fitness', label: 'Fitness', icon: '💪', color: '#7C3AED' },
  { path: '/journal', label: 'Journal', icon: '📓', color: '#EAB308' },
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
      <div className="flex items-center justify-around px-4 pt-2.5 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 btn-press min-w-0 flex-1"
              style={{
                color: isActive ? item.color : 'rgba(255,255,255,0.4)',
                textShadow: isActive ? `0 0 12px ${item.color}` : 'none',
                background: isActive ? `${item.color}14` : 'transparent',
              }}
            >
              <span className="text-2xl leading-none" style={{ filter: isActive ? `drop-shadow(0 0 8px ${item.color})` : 'none' }}>
                {item.icon}
              </span>
              <span className="text-[11px] font-semibold tracking-wide leading-none truncate max-w-full">
                {item.label}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
