import React, { useMemo, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { calcTargets, ACTIVITY_LEVELS } from '../lib/nutrition'
import { toKg } from '../lib/units'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#7C3AED'

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors'
const labelCls = 'block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest'

const ACTIVITY_OPTS = [
  { key: 'sedentary', label: 'Sedentary', hint: 'Little / no exercise' },
  { key: 'light', label: 'Light', hint: '1–3 days/week' },
  { key: 'moderate', label: 'Moderate', hint: '3–5 days/week' },
  { key: 'active', label: 'Active', hint: '6–7 days/week' },
  { key: 'veryActive', label: 'Very active', hint: 'Hard daily training' },
]

const GOAL_OPTS = [
  { key: 'cut', label: 'Lose fat', icon: '🔥' },
  { key: 'maintain', label: 'Maintain', icon: '⚖️' },
  { key: 'bulk', label: 'Build muscle', icon: '💪' },
]

function PrimaryButton({ children, onClick, disabled, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
      style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 24px ${COLOR}45` }}
    >
      {children}
    </button>
  )
}

export default function Onboarding({ onDone }) {
  const { user } = useAuth()
  const { addDocument: addProfile } = useFirestore('fitnessProfile')
  const { addDocument: addSettings } = useFirestore('settings')

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [units, setUnits] = useState('kg')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('male')
  const [heightCm, setHeightCm] = useState('')
  const [weight, setWeight] = useState('') // in chosen units
  const [activityLevel, setActivityLevel] = useState('moderate')
  const [goal, setGoal] = useState('maintain')
  const [goalWeight, setGoalWeight] = useState('') // in chosen units, optional

  const weightKg = useMemo(() => toKg(weight, units), [weight, units])
  const targets = useMemo(
    () => calcTargets({ sex, age, heightCm, weightKg, activityLevel, goal }),
    [sex, age, heightCm, weightKg, activityLevel, goal]
  )

  const TOTAL = 4

  async function finish() {
    if (saving) return
    setSaving(true)
    setErr('')
    try {
      const profile = {
        ...targets,
        age: Math.round(Number(age) || 0),
        sex,
        heightCm: Math.round(Number(heightCm) || 0),
        weightKg: Number(Number(weightKg).toFixed(2)) || 0,
        activityLevel: ACTIVITY_LEVELS[activityLevel] != null ? activityLevel : 'moderate',
        goal,
      }
      const gw = toKg(goalWeight, units)
      if (goalWeight !== '' && Number.isFinite(gw) && gw > 0) {
        profile.goalWeight = Number(gw.toFixed(2))
      }
      await addProfile(profile)
      await addSettings({ displayName: displayName.trim(), units })
      onDone?.()
    } catch (e) {
      setErr('Could not save. Please try again.')
      setSaving(false)
    }
  }

  async function skip() {
    if (saving) return
    setSaving(true)
    setErr('')
    try {
      // Minimal settings doc so onboarding never reappears.
      await addSettings({ displayName: displayName.trim(), units })
      onDone?.()
    } catch (e) {
      setErr('Could not save. Please try again.')
      setSaving(false)
    }
  }

  const canNextStats =
    Number(age) > 0 && Number(heightCm) > 0 && Number(weight) > 0

  return (
    <div className="page-enter min-h-screen p-5 pt-14 pb-16 flex flex-col max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full transition-all"
            style={{ background: i <= step ? COLOR : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>

      {/* Step 0 — welcome + name */}
      {step === 0 && (
        <div className="flex-1 flex flex-col">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-white">Welcome to LifeOS</h1>
          <p className="text-white/50 text-sm mt-2 mb-8">
            Let's set up your profile. It takes about a minute — you can skip anytime.
          </p>
          <div>
            <label className={labelCls}>What should we call you?</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="mt-auto pt-8 space-y-3">
            <PrimaryButton onClick={() => setStep(1)}>Get started</PrimaryButton>
            <button onClick={skip} disabled={saving}
              className="btn-press w-full py-3 rounded-xl text-sm font-semibold text-white/50 bg-white/5 border border-white/10">
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — units */}
      {step === 1 && (
        <div className="flex-1 flex flex-col">
          <h1 className="text-2xl font-black tracking-[-0.02em] text-white">Preferred units</h1>
          <p className="text-white/50 text-sm mt-2 mb-6">How would you like to track your weight?</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ u: 'kg', l: 'Kilograms' }, { u: 'lb', l: 'Pounds' }].map(({ u, l }) => (
              <button
                key={u}
                onClick={() => setUnits(u)}
                className="btn-press py-6 rounded-2xl font-bold transition-all"
                style={{
                  background: units === u ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                  color: units === u ? COLOR : 'rgba(255,255,255,0.6)',
                  border: `1px solid ${units === u ? COLOR + '70' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="text-2xl uppercase">{u}</div>
                <div className="text-xs mt-1 font-semibold opacity-80">{l}</div>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-8 flex gap-3">
            <BackButton onClick={() => setStep(0)} />
            <PrimaryButton onClick={() => setStep(2)}>Continue</PrimaryButton>
          </div>
        </div>
      )}

      {/* Step 2 — stats */}
      {step === 2 && (
        <div className="flex-1 flex flex-col">
          <h1 className="text-2xl font-black tracking-[-0.02em] text-white">About you</h1>
          <p className="text-white/50 text-sm mt-2 mb-6">We'll use this to estimate your daily targets.</p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Age</label>
                <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)}
                  placeholder="years" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Height (cm)</label>
                <input type="number" inputMode="numeric" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="cm" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Sex</label>
              <div className="grid grid-cols-2 gap-2">
                {['male', 'female'].map((s) => (
                  <button key={s} onClick={() => setSex(s)}
                    className="btn-press py-2.5 rounded-xl text-sm font-bold capitalize"
                    style={{
                      background: sex === s ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                      color: sex === s ? COLOR : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${sex === s ? COLOR + '60' : 'transparent'}`,
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Weight ({units})</label>
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)}
                placeholder={units} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Activity level</label>
              <div className="space-y-2">
                {ACTIVITY_OPTS.map((a) => (
                  <button key={a.key} onClick={() => setActivityLevel(a.key)}
                    className="btn-press w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: activityLevel === a.key ? `${COLOR}20` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${activityLevel === a.key ? COLOR + '60' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <span className="text-sm font-bold text-white">{a.label}</span>
                    <span className="text-[11px] text-white/40">{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Goal</label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_OPTS.map((g) => (
                  <button key={g.key} onClick={() => setGoal(g.key)}
                    className="btn-press py-3 rounded-xl text-center transition-all"
                    style={{
                      background: goal === g.key ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${goal === g.key ? COLOR + '60' : 'transparent'}`,
                    }}>
                    <div className="text-xl">{g.icon}</div>
                    <div className="text-[11px] font-bold mt-1" style={{ color: goal === g.key ? COLOR : 'rgba(255,255,255,0.6)' }}>
                      {g.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <BackButton onClick={() => setStep(1)} />
            <PrimaryButton onClick={() => setStep(3)} disabled={!canNextStats}>Continue</PrimaryButton>
          </div>
        </div>
      )}

      {/* Step 3 — review + goal weight */}
      {step === 3 && (
        <div className="flex-1 flex flex-col">
          <div className="text-4xl mb-3">🎯</div>
          <h1 className="text-2xl font-black tracking-[-0.02em] text-white">Your daily targets</h1>
          <p className="text-white/50 text-sm mt-2 mb-6">Estimated from your details — you can fine-tune these later in Settings.</p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Calories', value: targets.calories, suffix: 'kcal' },
              { label: 'Protein', value: targets.protein, suffix: 'g' },
              { label: 'Carbs', value: targets.carbs, suffix: 'g' },
              { label: 'Fat', value: targets.fat, suffix: 'g' },
            ].map((t) => (
              <div key={t.label} className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                <div className="text-2xl font-black text-white">{t.value}</div>
                <div className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">
                  {t.label} <span className="text-white/25">{t.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <label className={labelCls}>Goal weight ({units}) — optional</label>
            <input type="number" inputMode="decimal" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)}
              placeholder={`Target weight in ${units}`} className={inputCls} />
          </div>

          {err && <p className="text-red-400 text-xs font-semibold mt-4">{err}</p>}

          <div className="mt-auto pt-8 flex gap-3 items-center">
            <BackButton onClick={() => setStep(2)} />
            <PrimaryButton onClick={finish} disabled={saving}>
              {saving ? <span className="inline-flex items-center gap-2"><LoadingSpinner size={16} color="#fff" /> Saving…</span> : 'Finish setup'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="btn-press w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-white/60 bg-white/5 border border-white/10"
      aria-label="Back">
      ‹
    </button>
  )
}
