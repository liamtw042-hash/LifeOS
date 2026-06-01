import React from 'react'

export default function LoadingSpinner({ color = '#7C3AED', size = 24 }) {
  return (
    <div className="flex items-center justify-center">
      <div
        className="rounded-full border-2 border-transparent animate-spin"
        style={{
          width: size,
          height: size,
          borderTopColor: color,
          borderRightColor: color + '40',
        }}
      />
    </div>
  )
}
