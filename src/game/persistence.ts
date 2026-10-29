import type { SavedGameState } from './types'

const STORAGE_KEY = 'threez-game-state-v1'

export const readSavedGameState = (): SavedGameState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedGameState
    if (!Array.isArray(parsed.tiles) || !parsed.survivor || typeof parsed.zoom !== 'number') return null
    if (!Array.isArray(parsed.deck) || !Array.isArray(parsed.hand) || !Array.isArray(parsed.discard)) return null
    return parsed
  } catch {
    return null
  }
}
