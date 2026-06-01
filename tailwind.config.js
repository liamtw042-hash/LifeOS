/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        goals: '#7C3AED',
        habits: '#06B6D4',
        money: '#10B981',
        fitness: '#F97316',
        projects: '#EC4899',
        journal: '#EAB308',
        school: '#3B82F6',
        dashboard: '#7C3AED',
        card: '#0A0A0A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'blob1': 'blob1 18s ease-in-out infinite',
        'blob2': 'blob2 22s ease-in-out infinite',
        'blob3': 'blob3 26s ease-in-out infinite',
        'fadeInUp': 'fadeInUp 0.4s ease-out forwards',
        'bounceIn': 'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slideUp': 'slideUp 0.3s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        blob1: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(60px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-40px,30px) scale(0.95)' },
        },
        blob2: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(-70px,50px) scale(0.9)' },
          '66%': { transform: 'translate(50px,-60px) scale(1.1)' },
        },
        blob3: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(40px,70px) scale(1.05)' },
          '66%': { transform: 'translate(-60px,-30px) scale(0.95)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
  safelist: [
    'text-goals', 'text-habits', 'text-money', 'text-fitness', 'text-projects', 'text-journal', 'text-school', 'text-dashboard',
    'bg-goals', 'bg-habits', 'bg-money', 'bg-fitness', 'bg-projects', 'bg-journal', 'bg-school', 'bg-dashboard',
    'border-goals', 'border-habits', 'border-money', 'border-fitness', 'border-projects', 'border-journal', 'border-school',
    'shadow-goals', 'shadow-habits', 'shadow-money', 'shadow-fitness', 'shadow-projects', 'shadow-journal', 'shadow-school',
  ],
}
