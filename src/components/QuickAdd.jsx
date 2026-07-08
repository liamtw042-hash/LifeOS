import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'

const COLOR = '#7C3AED'

const ACTIONS = [
  { key: 'search', icon: '🔍', label: 'Search', action: 'search' },
  { key: 'food', icon: '🍽️', label: 'Log food', to: '/fitness', state: { tab: 'food' } },
  { key: 'train', icon: '💪', label: 'Start workout', to: '/fitness', state: { tab: 'train' } },
  { key: 'journal', icon: '📓', label: 'Journal entry', to: '/journal' },
  { key: 'goal', icon: '🎯', label: 'New goal', to: '/' },
]

export default function QuickAdd() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Collapse on scroll so the menu never lingers over content.
  useEffect(() => {
    if (!open) return
    const onScroll = () => setOpen(false)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [open])

  function handleAction(a) {
    setOpen(false)
    if (a.action === 'search') { setSearchOpen(true); return }
    if (a.state) navigate(a.to, { state: a.state })
    else navigate(a.to)
  }

  // Sits above the bottom nav (~96px) + safe area.
  const bottomOffset = 'calc(108px + env(safe-area-inset-bottom))'

  return (
    <>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Scrim — closes menu on outside tap */}
      {open && (
        <div
          className="fixed inset-0 z-40 animate-fadeIn"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-3"
        style={{ bottom: bottomOffset }}
      >
        {/* Expanded actions */}
        {open && (
          <div className="flex flex-col items-end gap-2.5">
            {ACTIONS.map((a, i) => (
              <button
                key={a.key}
                onClick={() => handleAction(a)}
                className="btn-press flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 rounded-full animate-slideUp"
                style={{
                  animationDelay: `${i * 40}ms`,
                  background: 'rgba(20,20,24,0.95)',
                  border: `1px solid ${COLOR}55`,
                  boxShadow: `0 0 16px ${COLOR}30`,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <span className="text-[13px] font-bold text-white whitespace-nowrap">{a.label}</span>
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: `${COLOR}22` }}
                >
                  {a.icon}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Quick add"
          className="btn-press w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white transition-transform duration-300"
          style={{
            background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`,
            boxShadow: `0 0 24px ${COLOR}70`,
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </button>
      </div>
    </>
  )
}
