// Weight unit helpers. Internal storage is always kilograms.
const LB_PER_KG = 2.20462

export function formatWeight(kg, units = 'kg') {
  const n = Number(kg)
  if (!Number.isFinite(n)) return units === 'lb' ? '0.0 lb' : '0.0 kg'
  if (units === 'lb') return `${(n * LB_PER_KG).toFixed(1)} lb`
  return `${n.toFixed(1)} kg`
}

// Convert a value entered in the user's chosen units back to kg for storage.
export function toKg(value, units = 'kg') {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return units === 'lb' ? n / LB_PER_KG : n
}

// Convert a stored kg value into the user's chosen units for display in an input.
export function fromKg(kg, units = 'kg') {
  const n = Number(kg)
  if (!Number.isFinite(n)) return 0
  return units === 'lb' ? n * LB_PER_KG : n
}

export const UNIT_LABELS = { kg: 'Kilograms (kg)', lb: 'Pounds (lb)' }
