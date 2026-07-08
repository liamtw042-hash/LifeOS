// Lightweight opt-in reminders using the Web Notifications API.
// No backend / push — fires only while the app is open. Everything is guarded
// so it never throws when Notification is unsupported or denied.

const STORAGE_KEY = 'lifeos.reminders.fired'

export const REMINDER_DEFS = [
  { key: 'water', label: 'Drink water', icon: '💧', defaultTime: '13:00', title: 'Time to hydrate 💧', body: 'Grab a glass of water.' },
  { key: 'dinner', label: 'Log dinner', icon: '🍽️', defaultTime: '19:30', title: 'Log your dinner 🍽️', body: "Don't forget to log tonight's meal." },
  { key: 'workout', label: 'Workout time', icon: '💪', defaultTime: '17:00', title: 'Workout time 💪', body: 'Time to train.' },
]

export function defaultReminders() {
  const out = {}
  for (const d of REMINDER_DEFS) {
    out[d.key] = { enabled: false, time: d.defaultTime }
  }
  return out
}

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permissionStatus() {
  if (!isSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch (e) {
    return 'denied'
  }
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readFired() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { date: todayKey(), keys: [] }
    const parsed = JSON.parse(raw)
    if (parsed.date !== todayKey()) return { date: todayKey(), keys: [] }
    return { date: parsed.date, keys: Array.isArray(parsed.keys) ? parsed.keys : [] }
  } catch (e) {
    return { date: todayKey(), keys: [] }
  }
}

function markFired(key) {
  try {
    const state = readFired()
    if (!state.keys.includes(key)) state.keys.push(key)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) { /* ignore */ }
}

function hasFired(key) {
  return readFired().keys.includes(key)
}

function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fire(def, reminder) {
  if (permissionStatus() !== 'granted') return
  try {
    // eslint-disable-next-line no-new
    new Notification(def.title, { body: def.body, icon: '/icons/icon-192.png', tag: `lifeos-${def.key}` })
    markFired(def.key)
  } catch (e) { /* ignore */ }
}

// Starts a once-a-minute checker. getReminders() must return the latest
// { water: {enabled, time}, ... } from settings. Returns a stop() fn.
export function startScheduler(getReminders) {
  if (typeof window === 'undefined') return () => {}

  function tick() {
    if (permissionStatus() !== 'granted') return
    let reminders
    try {
      reminders = getReminders() || {}
    } catch (e) {
      return
    }
    const current = nowHHMM()
    for (const def of REMINDER_DEFS) {
      const r = reminders[def.key]
      if (!r || !r.enabled || !r.time) continue
      if (r.time === current && !hasFired(def.key)) {
        fire(def, r)
      }
    }
  }

  tick()
  const id = setInterval(tick, 60000)
  return () => clearInterval(id)
}
