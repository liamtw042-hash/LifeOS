import React, { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, accentColor = '#7C3AED' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, rgba(124,58,237,0.10), transparent 55%), rgba(0,0,0,0.72)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-0 sm:mx-4 glass-card animate-slideUp rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          maxHeight: '90vh',
          boxShadow: `0 -8px 60px rgba(0,0,0,0.6), 0 0 40px ${accentColor}22, inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
      >
        {/* Glowing top accent bar */}
        <div
          className="h-[3px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            boxShadow: `0 0 14px ${accentColor}, 0 0 4px ${accentColor}`,
          }}
        />

        {/* Handle for mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="hairline-b flex items-center justify-between px-6 pt-4 pb-3">
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="btn-press w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 88px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
