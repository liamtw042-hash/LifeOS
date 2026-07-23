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
        background: 'rgba(6,7,12,0.82)',
        backdropFilter: 'blur(18px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
        borderTop: '1px solid var(--line)',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* faint top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.35), rgba(34,211,238,0.30), transparent)' }}
      />
      <div className="flex items-center justify-around px-4 pt-2.5 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl btn-press min-w-0 flex-1"
              style={{
                color: isActive ? item.color : 'rgba(255,255,255,0.42)',
                textShadow: isActive ? `0 0 12px ${item.color}` : 'none',
                background: isActive ? `${item.color}16` : 'transparent',
                transition: 'color 250ms ease, background 250ms ease, text-shadow 250ms ease',
              }}
            >
              <span
                className="text-2xl leading-none"
                style={{
                  filter: isActive ? `drop-shadow(0 0 8px ${item.color})` : 'none',
                  transform: isActive ? 'translateY(-1px)' : 'none',
                  transition: 'filter 250ms ease, transform 250ms ease',
                }}
              >
                {item.icon}
              </span>
              <span className="text-[11px] font-semibold tracking-wide leading-none truncate max-w-full">
                {item.label}
              </span>
              {/* Glowing animated active indicator (soft pill underline) */}
              <span
                className="absolute -bottom-0.5 left-1/2 h-[3px] rounded-full pointer-events-none"
                style={{
                  width: '26px',
                  background: item.color,
                  boxShadow: `0 0 10px ${item.color}, 0 0 4px ${item.color}`,
                  transform: `translateX(-50%) scaleX(${isActive ? 1 : 0})`,
                  opacity: isActive ? 1 : 0,
                  transition: 'transform 250ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 250ms ease',
                }}
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
