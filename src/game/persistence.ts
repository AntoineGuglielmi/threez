import type { SavedGameState } from './types'

export const readSavedGameState = async (): Promise<SavedGameState | null> => {
  try {
    const response = await fetch('/__game-state')
    if (!response.ok) throw new Error('Unable to load committed game state')
    const parsed = await response.json() as SavedGameState
    if (!Array.isArray(parsed.tiles) || !parsed.survivor || typeof parsed.zoom !== 'number') return null
    if (!Array.isArray(parsed.deck) || !Array.isArray(parsed.hand) || !Array.isArray(parsed.discard)) return null
    return parsed
  } catch {
    return null
  }
}
