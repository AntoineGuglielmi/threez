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

const directionRotation: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 }

const corridorPerspective = (direction: Direction) => `
  <g transform="rotate(${directionRotation[direction]} 64 64)">
    <path d="M43 60L85 60L112 13H16Z" class="cc-floor-plane"/>
    <path d="M16 13L43 60L43 69L12 29Z" class="cc-wall-side cc-wall-side-left"/>
    <path d="M112 13L85 60L85 69L116 29Z" class="cc-wall-side cc-wall-side-right"/>
    <path d="M43 60L64 53L85 60" class="cc-perspective-line"/>
    <path d="M31 38L52 60M97 38L76 60" class="cc-floor-seam"/>
  </g>
`

const endWallMarkup: Record<Direction, string> = {
  N: '<g><path d="M12 12H116V30L85 60H43L12 30Z" class="cc-end-wall"/><path d="M12 12H116" class="cc-wall-highlight"/></g>',
  E: '<g transform="rotate(90 64 64)"><path d="M12 12H116V30L85 60H43L12 30Z" class="cc-end-wall"/><path d="M12 12H116" class="cc-wall-highlight"/></g>',
  S: '<g transform="rotate(180 64 64)"><path d="M12 12H116V30L85 60H43L12 30Z" class="cc-end-wall"/><path d="M12 12H116" class="cc-wall-highlight"/></g>',
  W: '<g transform="rotate(270 64 64)"><path d="M12 12H116V30L85 60H43L12 30Z" class="cc-end-wall"/><path d="M12 12H116" class="cc-wall-highlight"/></g>',
}

const doorMarkup: Record<Direction, string> = {
  N: '<g><path d="M12 12H43V30H12ZM85 12H116V30H85Z" class="cc-end-wall"/><path d="M43 12H85V30L76 41H52L43 30Z" class="cc-door-frame"/><path d="M49 15H79V29L73 36H55L49 29Z" class="cc-door-leaf"/><path d="M55 29H73L78 36H50Z" class="cc-door-shadow"/></g>',
  E: '<g transform="rotate(90 64 64)"><path d="M12 12H43V30H12ZM85 12H116V30H85Z" class="cc-end-wall"/><path d="M43 12H85V30L76 41H52L43 30Z" class="cc-door-frame"/><path d="M49 15H79V29L73 36H55L49 29Z" class="cc-door-leaf"/><path d="M55 29H73L78 36H50Z" class="cc-door-shadow"/></g>',
  S: '<g transform="rotate(180 64 64)"><path d="M12 12H43V30H12ZM85 12H116V30H85Z" class="cc-end-wall"/><path d="M43 12H85V30L76 41H52L43 30Z" class="cc-door-frame"/><path d="M49 15H79V29L73 36H55L49 29Z" class="cc-door-leaf"/><path d="M55 29H73L78 36H50Z" class="cc-door-shadow"/></g>',
  W: '<g transform="rotate(270 64 64)"><path d="M12 12H43V30H12ZM85 12H116V30H85Z" class="cc-end-wall"/><path d="M43 12H85V30L76 41H52L43 30Z" class="cc-door-frame"/><path d="M49 15H79V29L73 36H55L49 29Z" class="cc-door-leaf"/><path d="M55 29H73L78 36H50Z" class="cc-door-shadow"/></g>',
}

const floorDetails = `
  <g class="cc-paper">
    <path d="M50 72l10 -3 5 8 -10 4z M52 74l5 -1 M54 77l6 -2"/>
    <path d="M78 44l8 -2 3 7 -8 3z M80 45l4 -1"/>
  </g>
  <g class="cc-blood">
    <rect x="68" y="74" width="4" height="4"/><rect x="72" y="78" width="3" height="3"/>
    <rect x="76" y="81" width="3" height="3"/><rect x="43" y="47" width="3" height="3"/>
  </g>
  <g class="cc-debris">
    <rect x="35" y="67" width="5" height="2"/><rect x="89" y="58" width="4" height="3"/>
    <rect x="61" y="88" width="6" height="2"/>
  </g>
`

const getArtwork = (card: CorridorCard, turns: number) => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !exits.includes(direction))

  const corridors = exits.map(corridorPerspective).join('')
  const walls = directionOrder
    .filter((direction) => !exits.includes(direction) && !doors.includes(direction))
    .map((direction) => endWallMarkup[direction])
    .join('')
  const doorsMarkup = doors.map((direction) => doorMarkup[direction]).join('')
  const openingMarks: Record<Direction, string> = {
    N: '<path d="M58 11H70V16H58Z"/>',
    E: '<path d="M112 58H117V70H112Z"/>',
    S: '<path d="M58 112H70V117H58Z"/>',
    W: '<path d="M11 58H16V70H11Z"/>',
  }

  return `
    <svg class="cc-card-art" viewBox="0 0 128 128" role="img" aria-label="Couloir, sorties : ${exits.join(', ') || 'aucune'}, portes : ${doors.length ? doors.join(', ') : 'aucune'}" shape-rendering="crispEdges">
      <path d="M8 8H120V120H8Z" class="cc-shadow"/>
      <path d="M12 12H116V116H12Z" class="cc-room-backdrop"/>
      <g class="cc-corridors">${corridors}</g>
      <g class="cc-end-walls">${walls}${doorsMarkup}</g>
      ${floorDetails}
      <g class="cc-openings">${exits.map((direction) => openingMarks[direction]).join('')}</g>
      <path d="M12 12H116V116H12Z" class="cc-card-frame"/>
    </svg>
  `
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

  button.innerHTML = `<span class="cc-card-index">${String(index + 1).padStart(2, '0')}</span>${getArtwork(card, turns)}<span class="cc-card-name">${shapeLabel[card.kind]}<small>${doorLabel}</small></span>`
  button.addEventListener('click', onSelect)
  return button
}
