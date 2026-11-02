import { createCorridorPixelArt } from './corridor-pixel-art'
import type { CorridorCard } from '../game/types'

type CorridorHandCardOptions = {
  card: CorridorCard
  selected: boolean
  turns: number
  disabled: boolean
  onSelect: () => void
}

export const createCorridorHandCard = ({
  card,
  selected,
  turns,
  disabled,
  onSelect,
}: CorridorHandCardOptions): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `cc-card${selected ? ' is-selected' : ''}`
  button.disabled = disabled
  button.setAttribute('aria-pressed', String(selected))
  button.setAttribute('aria-label', 'Sélectionner ce couloir')
  button.append(createCorridorPixelArt(card, turns))
  button.addEventListener('click', onSelect)
  return button
}
