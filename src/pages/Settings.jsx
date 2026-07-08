import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { formatWeight } from '../lib/units'
import { exportAllData, importAllData } from '../lib/dataTransfer'
import {
  REMINDER_DEFS, defaultReminders, isSupported,
  permissionStatus, requestPermission,
} from '../lib/reminders'

const COLOR = '#7C3AED'
const DEFAULT_TARGETS = { calories: 2200, protein: 150, carbs: 220, fat: 70 }
const APP_VERSION = 'LifeOS v1.0'

function Section({ icon, title, children }) {
  return (
    <Card accentColor={COLOR} className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-black text-white uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#7C3AED] transition-colors'
const labelCls = 'block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest'

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout, getIdToken } = useAuth()

  const {
    docs: settingsDocs, fetchDocs: fetchSettings,
    addDocument: addSettings, updateDocument: updateSettings,
  } = useFirestore('settings')
  const {
    docs: profiles, fetchDocs: fetchProfile,
    addDocument: addProfile, updateDocument: updateProfile,
  } = useFirestore('fitnessProfile')

  useEffect(() => { fetchSettings(); fetchProfile() }, [fetchSettings, fetchProfile])

  const settingsDoc = (settingsDocs || [])[0] || null
  const profile = (profiles || [])[0] || null

  // ---- local form state ----
  const [displayName, setDisplayName] = useState('')
  const [units, setUnits] = useState('kg')
  const [reminders, setReminders] = useState(defaultReminders())
  const [targets, setTargets] = useState(DEFAULT_TARGETS)
  const [savedFlash, setSavedFlash] = useState('')

  useEffect(() => {
    if (settingsDoc) {
      setDisplayName(settingsDoc.displayName || user?.displayName || '')
      setUnits(settingsDoc.units === 'lb' ? 'lb' : 'kg')
      setReminders({ ...defaultReminders(), ...(settingsDoc.reminders || {}) })
    } else {
      setDisplayName(user?.displayName || '')
    }
  }, [settingsDoc, user])

  useEffect(() => {
    setTargets({
      calories: profile?.calories ?? DEFAULT_TARGETS.calories,
      protein: profile?.protein ?? DEFAULT_TARGETS.protein,
      carbs: profile?.carbs ?? DEFAULT_TARGETS.carbs,
      fat: profile?.fat ?? DEFAULT_TARGETS.fat,
    })
  }, [profile])

  function flash(msg) {
    setSavedFlash(msg)
    setTimeout(() => setSavedFlash(''), 1800)
  }

  async function saveSettings(patch) {
    const next = {
      displayName,
      units,
      reminders,
      ...patch,
    }
    if (settingsDoc) await updateSettings(settingsDoc.id, next)
    else await addSettings(next)
  }

  async function handleSaveProfileSection() {
    await saveSettings({})
    flash('Profile saved ✓')
  }

  async function handleSetUnits(u) {
    setUnits(u)
    await saveSettings({ units: u })
  }

  async function handleSaveTargets() {
    const payload = {
      calories: Math.round(Number(targets.calories) || 0),
      protein: Math.round(Number(targets.protein) || 0),
      carbs: Math.round(Number(targets.carbs) || 0),
      fat: Math.round(Number(targets.fat) || 0),
    }
    if (profile) await updateProfile(profile.id, payload)
    else await addProfile(payload)
    flash('Targets saved ✓')
  }

  async function handleToggleReminder(key) {
    const next = { ...reminders, [key]: { ...reminders[key], enabled: !reminders[key]?.enabled } }
    setReminders(next)
    await saveSettings({ reminders: next })
  }

  async function handleReminderTime(key, time) {
    const next = { ...reminders, [key]: { ...reminders[key], time } }
    setReminders(next)
    await saveSettings({ reminders: next })
  }

  // ---- notifications permission ----
  const [permStatus, setPermStatus] = useState(permissionStatus())
  async function handleEnableNotifications() {
    const res = await requestPermission()
    setPermStatus(res)
  }

  // ---- data transfer ----
  const fileRef = useRef(null)
  const [busy, setBusy] = useState('')
  const [dataMsg, setDataMsg] = useState(null) // { type, text }
  const [pendingImport, setPendingImport] = useState(null) // parsed json awaiting confirm

  async function handleExport() {
    setBusy('export')
    setDataMsg(null)
    try {
      const res = await exportAllData({ getIdToken, uid: user.uid })
      setDataMsg({ type: 'ok', text: `Exported ${res.total} items across ${res.collections} collections.` })
    } catch (e) {
      setDataMsg({ type: 'err', text: `Export failed: ${e.message}` })
    } finally {
      setBusy('')
    }
  }

  function handlePickFile(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        setPendingImport(parsed)
      } catch (err) {
        setDataMsg({ type: 'err', text: 'Could not read file: invalid JSON.' })
      }
    }
    reader.onerror = () => setDataMsg({ type: 'err', text: 'Could not read file.' })
    reader.readAsText(file)
  }

  async function confirmImport() {
    const data = pendingImport
    setPendingImport(null)
    if (!data) return
    setBusy('import')
    setDataMsg(null)
    try {
      const summary = await importAllData(data, { getIdToken, uid: user.uid })
      setDataMsg({
        type: 'ok',
        text: `Import complete: ${summary.added} added, ${summary.skipped} skipped, ${summary.errors} errors.`,
      })
      fetchSettings(); fetchProfile()
    } catch (e) {
      setDataMsg({ type: 'err', text: `Import failed: ${e.message}` })
    } finally {
      setBusy('')
    }
  }

  const previewWeight = useMemo(() => formatWeight(75, units), [units])

  return (
    <div className="page-enter min-h-screen p-4 pt-10 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="btn-press w-9 h-9 rounded-full flex items-center justify-center text-white/60 bg-white/5 border border-white/10"
          aria-label="Back to dashboard"
        >
          ‹
        </button>
        <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Settings</h1>
      </div>

      {savedFlash && (
        <div className="text-sm font-bold text-center py-2 rounded-xl" style={{ background: `${COLOR}22`, color: COLOR }}>
          {savedFlash}
        </div>
      )}

      {/* Profile */}
      <Section icon="👤" title="Profile">
        <div>
          <label className={labelCls}>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name" className={inputCls} />
        </div>
        <button onClick={handleSaveProfileSection}
          className="btn-press w-full py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
          Save profile
        </button>
      </Section>

      {/* Units */}
      <Section icon="⚖️" title="Units">
        <div className="grid grid-cols-2 gap-2">
          {['kg', 'lb'].map((u) => (
            <button key={u} onClick={() => handleSetUnits(u)}
              className="btn-press py-2.5 rounded-xl text-sm font-bold uppercase"
              style={{
                background: units === u ? `${COLOR}25` : 'rgba(255,255,255,0.04)',
                color: units === u ? COLOR : 'rgba(255,255,255,0.5)',
                border: `1px solid ${units === u ? COLOR + '60' : 'transparent'}`,
              }}>
              {u}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/35">Example: 75kg shows as <span className="text-white/60 font-semibold">{previewWeight}</span></p>
      </Section>

      {/* Nutrition targets */}
      <Section icon="🍽️" title="Nutrition Targets">
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'calories', label: 'Calories' },
            { key: 'protein', label: 'Protein (g)' },
            { key: 'carbs', label: 'Carbs (g)' },
            { key: 'fat', label: 'Fat (g)' },
          ].map((f) => (
            <div key={f.key}>
              <label className={labelCls}>{f.label}</label>
              <input type="number" value={targets[f.key]}
                onChange={(e) => setTargets((t) => ({ ...t, [f.key]: e.target.value }))}
                className={inputCls} />
            </div>
          ))}
        </div>
        <button onClick={handleSaveTargets}
          className="btn-press w-full py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: `linear-gradient(135deg, ${COLOR}, #6D28D9)`, boxShadow: `0 0 20px ${COLOR}40` }}>
          Save targets
        </button>
      </Section>

      {/* Reminders */}
      <Section icon="🔔" title="Reminders">
        {!isSupported() ? (
          <p className="text-sm text-white/40">Notifications are not supported on this device.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/60">
                Status: <span className="font-bold text-white/80 capitalize">{permStatus}</span>
              </div>
              {permStatus !== 'granted' && (
                <button onClick={handleEnableNotifications}
                  className="btn-press px-3 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: COLOR }}>
                  Enable notifications
                </button>
              )}
            </div>
            {permStatus === 'denied' && (
              <p className="text-[11px] text-white/35">Notifications are blocked. Enable them in your browser settings.</p>
            )}
            <div className="space-y-2">
              {REMINDER_DEFS.map((def) => {
                const r = reminders[def.key] || { enabled: false, time: def.defaultTime }
                return (
                  <div key={def.key} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-base">{def.icon}</span>
                    <span className="flex-1 text-sm font-bold text-white/85">{def.label}</span>
                    <input type="time" value={r.time || def.defaultTime}
                      onChange={(e) => handleReminderTime(def.key, e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm" />
                    <button onClick={() => handleToggleReminder(def.key)}
                      className="btn-press w-12 h-7 rounded-full flex-shrink-0 relative transition-colors"
                      style={{ background: r.enabled ? COLOR : 'rgba(255,255,255,0.12)' }}
                      aria-label={`Toggle ${def.label}`}>
                      <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
                        style={{ left: r.enabled ? '22px' : '2px' }} />
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-white/35">Reminders fire while the app is open, once per day at the set time.</p>
          </>
        )}
      </Section>

      {/* Data */}
      <Section icon="💾" title="Data">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleExport} disabled={busy === 'export'}
            className="btn-press py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80 disabled:opacity-50">
            <span>⬇️</span> {busy === 'export' ? 'Exporting…' : 'Export'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy === 'import'}
            className="btn-press py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/80 disabled:opacity-50">
            <span>⬆️</span> {busy === 'import' ? 'Importing…' : 'Import'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" onChange={handlePickFile} className="hidden" />
        {dataMsg && (
          <p className={`text-[12px] font-semibold ${dataMsg.type === 'err' ? 'text-red-400' : 'text-green-400'}`}>
            {dataMsg.text}
          </p>
        )}
        <p className="text-[11px] text-white/35">Export downloads a JSON backup. Import adds to your existing data (never deletes).</p>
      </Section>

      {/* Account */}
      <Section icon="🔑" title="Account">
        <div className="text-sm text-white/50">{user?.email}</div>
        <button onClick={logout}
          className="btn-press w-full py-3 rounded-xl font-bold text-white text-sm bg-white/5 border border-white/10">
          Sign out
        </button>
        <p className="text-[11px] text-white/30 text-center">{APP_VERSION}</p>
      </Section>

      {/* Import confirm modal */}
      <Modal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} title="Import data?" accentColor={COLOR}>
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            This will <span className="font-bold text-white">add</span> all items from the backup to your existing data.
            It will not delete or overwrite anything, so duplicates are possible.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPendingImport(null)}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-semibold text-white/60 bg-white/5 border border-white/10">
              Cancel
            </button>
            <button onClick={confirmImport}
              className="btn-press flex-1 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: COLOR }}>
              Import
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
