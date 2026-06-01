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
      <div
        className="absolute rounded-full animate-blob1"
        style={{
          width: '500px',
          height: '500px',
          top: '-150px',
          left: '-100px',
          background: colors[0],
          opacity: 0.12,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute rounded-full animate-blob2"
        style={{
          width: '400px',
          height: '400px',
          bottom: '100px',
          right: '-100px',
          background: colors[1],
          opacity: 0.1,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute rounded-full animate-blob3"
        style={{
          width: '350px',
          height: '350px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: colors[2],
          opacity: 0.08,
          filter: 'blur(80px)',
        }}
      />
    </div>
  )
}
