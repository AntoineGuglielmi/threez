import { corridorDefinitions, directionOrder, rotateDirection } from '../game/directions'
import type { CorridorCard, CorridorKind, Direction } from '../game/types'

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

  const exits = corridorDefinitions[card.kind].exits
  const edgeLines: Record<Direction, string> = {
    N: 'M20 12H80',
    E: 'M88 20V80',
    S: 'M20 88H80',
    W: 'M12 20V80',
  }
  const wallLines = directionOrder
    .filter((direction) => !exits.includes(direction))
    .map((direction) => edgeLines[direction])
    .join('')
  const corridorLines = exits
    .map((direction) => {
      const ends: Record<Direction, string> = {
        N: 'M50 50V12',
        E: 'M50 50H88',
        S: 'M50 50V88',
        W: 'M50 50H12',
      }
      return ends[direction]
    })
    .join('')
  const doorRects: Record<Direction, string> = {
    N: '<rect x="43" y="9" width="14" height="6" rx="1" />',
    E: '<rect x="85" y="43" width="6" height="14" rx="1" />',
    S: '<rect x="43" y="85" width="14" height="6" rx="1" />',
    W: '<rect x="9" y="43" width="6" height="14" rx="1" />',
  }
  const doorMarkup = card.doors.filter((direction) => !exits.includes(direction)).map((direction) => doorRects[direction]).join('')
  const rotatedArtwork = turns === 0 ? '' : ` transform="rotate(${turns * 90} 50 50)"`
  const displayedDoors = card.doors
    .filter((direction) => !exits.includes(direction))
    .map((direction) => rotateDirection(direction, turns))
  const doorLabel = displayedDoors.length ? `Portes : ${displayedDoors.join(' / ')}` : 'Aucune porte'
  const shapeLabel: Record<CorridorKind, string> = {
    straight: 'Couloir droit',
    left: 'Couloir avec virage',
    right: 'Couloir avec virage',
    tee: 'Couloir en T',
    cross: 'Carrefour',
  }

  button.innerHTML = `<span class="cc-card-index">${String(index + 1).padStart(2, '0')}</span><svg class="cc-card-art" viewBox="0 0 100 100" role="img" aria-label="${shapeLabel[card.kind]}, ${displayedDoors.length ? displayedDoors.join(', ') : 'aucune porte'}"><rect class="cc-art-base" x="5" y="5" width="90" height="90" rx="2"/><path class="cc-art-grid" d="M35 8V92 M65 8V92 M8 35H92 M8 65H92"/><g${rotatedArtwork}><path class="cc-art-corridor-shadow" d="${corridorLines}"/><path class="cc-art-corridor" d="${corridorLines}"/><path class="cc-art-walls" d="${wallLines}"/><g class="cc-art-doors">${doorMarkup}</g><rect class="cc-art-marker" x="46" y="46" width="8" height="8"/></g></svg><span class="cc-card-name">${doorLabel}</span>`
  button.addEventListener('click', onSelect)
  return button
}
