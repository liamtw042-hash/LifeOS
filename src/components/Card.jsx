import React from 'react'

export default function Card({ children, className = '', accentColor, onClick, hover = false }) {
  const glowStyle = accentColor
    ? {
        '--glow-color': accentColor,
      }
    : {}

  return (
    <div
      className={`glass-card ${hover ? 'glass-card-hover cursor-pointer' : ''} p-4 ${className}`}
      style={{
        ...glowStyle,
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={
        hover && accentColor
          ? (e) => {
              e.currentTarget.style.boxShadow = `0 12px 34px rgba(0,0,0,0.5), 0 0 26px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.08)`
              e.currentTarget.style.borderColor = `${accentColor}66`
            }
          : undefined
      }
      onMouseLeave={
        hover && accentColor
          ? (e) => {
              e.currentTarget.style.boxShadow = ''
              e.currentTarget.style.borderColor = ''
            }
          : undefined
      }
      onClick={onClick}
    >
      {children}
    </div>
  )
}
