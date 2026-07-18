export const PROFILE_STORAGE_KEY = 'pawmenual.profile.v1'
export const MEAL_LOGS_STORAGE_KEY = 'pawmenual.mealLogs.v1'
export const HEALTH_LOGS_STORAGE_KEY = 'pawmenual.healthLogs.v1'
export const TRAINING_LOGS_STORAGE_KEY = 'pawmenual.trainingLogs.v1'
export const TRAINING_PROGRESS_STORAGE_KEY = 'pawmenual.trainingProgress.v1'

export function readJsonStorage(key, fallbackValue) {
  const raw = localStorage.getItem(key)

  if (!raw) {
    return fallbackValue
  }

  try {
    return JSON.parse(raw)
  } catch {
    return fallbackValue
  }
}

export function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
