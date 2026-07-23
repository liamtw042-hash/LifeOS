import React from 'react'

export default function LoadingSpinner({ color = '#7C3AED', size = 24 }) {
  const thickness = Math.max(2, Math.round(size / 12))
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="rounded-full animate-spin"
        style={{
          width: size,
          height: size,
          boxSizing: 'border-box',
          border: `${thickness}px solid ${color}1F`,
          borderTopColor: color,
          borderRightColor: `${color}99`,
          filter: `drop-shadow(0 0 6px ${color}80)`,
        }}
      />
    </div>
  )
}
