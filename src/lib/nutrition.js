// Nutrition math: BMR, TDEE and macro targets. Pure functions.

export const ACTIVITY_LEVELS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
}

export const GOAL_ADJUSTMENTS = {
  cut: -500,
  maintain: 0,
  bulk: 300,
}

const num = (x, fallback = 0) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Mifflin-St Jeor BMR.
 * sex: 'male' | 'female' (anything not 'female' treated as male)
 */
export function mifflinStJeor({ sex, age, heightCm, weightKg } = {}) {
  const a = num(age)
  const h = num(heightCm)
  const w = num(weightKg)
  const base = 10 * w + 6.25 * h - 5 * a
  const bmr = String(sex).toLowerCase() === 'female' ? base - 161 : base + 5
  return Math.max(0, Math.round(bmr))
}

/** Total daily energy expenditure. */
export function tdee(bmr, activityLevel) {
  const factor = ACTIVITY_LEVELS[activityLevel] != null ? ACTIVITY_LEVELS[activityLevel] : ACTIVITY_LEVELS.moderate
  return Math.round(num(bmr) * factor)
}

/**
 * calcTargets -> { calories, protein, carbs, fat }
 * Protein ~2.0 g/kg bodyweight, fat ~25% of calories, carbs = remainder.
 */
export function calcTargets({ sex, age, heightCm, weightKg, activityLevel, goal } = {}) {
  const w = num(weightKg)
  const bmr = mifflinStJeor({ sex, age, heightCm, weightKg })
  const maintenance = tdee(bmr, activityLevel)
  const adjustment = GOAL_ADJUSTMENTS[goal] != null ? GOAL_ADJUSTMENTS[goal] : 0
  let calories = maintenance + adjustment
  if (calories < 1200) calories = 1200 // floor for safety

  const protein = Math.round(w * 2.0)
  const fatCalories = calories * 0.25
  const fat = Math.round(fatCalories / 9)

  const proteinCalories = protein * 4
  let carbCalories = calories - proteinCalories - fat * 9
  if (carbCalories < 0) carbCalories = 0
  const carbs = Math.round(carbCalories / 4)

  return {
    calories: Math.round(calories),
    protein,
    carbs,
    fat,
  }
}
