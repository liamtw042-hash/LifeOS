import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, signup } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password, name)
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-100px] left-[-80px] w-80 h-80 rounded-full opacity-20 blur-[80px]" style={{ background: '#7C3AED', animation: 'blob1 18s ease-in-out infinite' }} />
      <div className="absolute bottom-[-80px] right-[-60px] w-64 h-64 rounded-full opacity-15 blur-[80px]" style={{ background: '#06B6D4', animation: 'blob2 22s ease-in-out infinite' }} />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">⚡</div>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-white">LifeOS</h1>
          <p className="text-white/40 text-sm mt-1 font-medium">Your complete life system</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6">
          {/* Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 btn-press"
                style={{
                  background: mode === m ? '#7C3AED' : 'transparent',
                  color: mode === m ? 'white' : 'rgba(255,255,255,0.4)',
                  boxShadow: mode === m ? '0 0 20px rgba(124,58,237,0.4)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-widest">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] focus:bg-white/8 transition-colors"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-widest">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 mt-2"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                boxShadow: loading ? 'none' : '0 0 30px rgba(124,58,237,0.5)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <LoadingSpinner size={20} color="white" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
