import { corridorDefinitions, rotateDirection } from '../game/directions'
import { createCorridorPixelArt } from './corridor-pixel-art'
import type { CorridorCard, CorridorKind } from '../game/types'

type CorridorHandCardOptions = {
  card: CorridorCard
  index: number
  selected: boolean
  turns: number
  disabled: boolean
  onSelect: () => void
}

export const createCorridorHandCard = ({
  card,
  index,
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

  const shapeLabel: Record<CorridorKind, string> = {
    straight: 'Couloir droit',
    left: 'Couloir avec virage',
    right: 'Couloir avec virage',
    tee: 'Couloir en T',
    cross: 'Carrefour',
  }
  const displayedExits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const displayedDoors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !displayedExits.includes(direction))
  const doorLabel = displayedDoors.length ? `Portes : ${displayedDoors.join(' / ')}` : 'Aucune porte'

  const indexLabel = document.createElement('span')
  indexLabel.className = 'cc-card-index'
  indexLabel.textContent = String(index + 1).padStart(2, '0')

  const name = document.createElement('span')
  name.className = 'cc-card-name'
  name.append(document.createTextNode(shapeLabel[card.kind]))
  const details = document.createElement('small')
  details.textContent = doorLabel
  name.append(details)

  button.append(indexLabel, createCorridorPixelArt(card, turns), name)
  button.addEventListener('click', onSelect)
  return button
}
