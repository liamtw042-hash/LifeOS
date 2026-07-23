import React from 'react'

const sectionColors = {
  dashboard: ['#7C3AED', '#4F46E5', '#2563EB'],
  goals: ['#7C3AED', '#9333EA', '#6D28D9'],
  habits: ['#06B6D4', '#0891B2', '#0E7490'],
  money: ['#10B981', '#059669', '#047857'],
  fitness: ['#F97316', '#EA580C', '#DC2626'],
  projects: ['#EC4899', '#DB2777', '#BE185D'],
  journal: ['#EAB308', '#CA8A04', '#F59E0B'],
  school: ['#3B82F6', '#2563EB', '#4F46E5'],
}

export default function GradientBackground({ section = 'dashboard' }) {
  const colors = sectionColors[section] || sectionColors.dashboard

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Base HUD depth: radial violet/cyan wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1000px 700px at 12% -8%, rgba(124,58,237,0.12), transparent 60%),' +
            'radial-gradient(820px 620px at 100% 4%, rgba(34,211,238,0.09), transparent 55%),' +
            'radial-gradient(900px 900px at 50% 118%, rgba(124,58,237,0.07), transparent 62%)',
        }}
      />

      {/* Faint hairline grid texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'radial-gradient(120% 120% at 50% 20%, #000 30%, transparent 92%)',
          WebkitMaskImage: 'radial-gradient(120% 120% at 50% 20%, #000 30%, transparent 92%)',
        }}
      />

      {/* Slow drifting section-tinted blobs */}
      <div
        className="absolute rounded-full animate-blob1"
        style={{
          width: '480px',
          height: '480px',
          top: '-150px',
          left: '-110px',
          background: colors[0],
          opacity: 0.11,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute rounded-full animate-blob2"
        style={{
          width: '420px',
          height: '420px',
          bottom: '80px',
          right: '-110px',
          background: '#22D3EE',
          opacity: 0.08,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute rounded-full animate-blob3"
        style={{
          width: '360px',
          height: '360px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: colors[2],
          opacity: 0.08,
          filter: 'blur(80px)',
        }}
      />

      {/* Vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  )
}
