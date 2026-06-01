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
              e.currentTarget.style.boxShadow = `0 0 20px ${accentColor}33`
              e.currentTarget.style.borderColor = `${accentColor}50`
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
