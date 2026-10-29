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

const floorArms: Record<Direction, string> = {
  N: '48,48 80,48 105,12 23,12',
  E: '80,48 80,80 116,105 116,23',
  S: '80,80 48,80 23,116 105,116',
  W: '48,80 48,48 12,23 12,105',
}

const wallMarkup: Record<Direction, string> = {
  N: '<g><path d="M12 12H116V20H12Z" class="cc-wall-top"/><path d="M12 20H116V29H12Z" class="cc-wall-face"/><path d="M12 12H116" class="cc-wall-edge"/></g>',
  E: '<g><path d="M108 12H116V116H108Z" class="cc-wall-top"/><path d="M99 12H108V116H99Z" class="cc-wall-face"/><path d="M108 12V116" class="cc-wall-edge"/></g>',
  S: '<g><path d="M12 108H116V116H12Z" class="cc-wall-top"/><path d="M12 99H116V108H12Z" class="cc-wall-face"/><path d="M12 108H116" class="cc-wall-edge"/></g>',
  W: '<g><path d="M12 12H20V116H12Z" class="cc-wall-top"/><path d="M20 12H29V116H20Z" class="cc-wall-face"/><path d="M20 12V116" class="cc-wall-edge"/></g>',
}

const doorMarkup: Record<Direction, string> = {
  N: '<g><path d="M12 12H43V20H12ZM85 12H116V20H85Z" class="cc-wall-top"/><path d="M12 20H43V29H12ZM85 20H116V29H85Z" class="cc-wall-face"/><path d="M44 12H84V20H44Z" class="cc-door-frame"/><path d="M49 14H79V18H49Z" class="cc-door-leaf"/><path d="M49 18L54 27H84L79 18Z" class="cc-door-shadow"/></g>',
  E: '<g><path d="M108 12H116V43H108ZM108 85H116V116H108Z" class="cc-wall-top"/><path d="M99 12H108V43H99ZM99 85H108V116H99Z" class="cc-wall-face"/><path d="M108 44H116V84H108Z" class="cc-door-frame"/><path d="M110 49H114V79H110Z" class="cc-door-leaf"/><path d="M99 49L108 54V84H99Z" class="cc-door-shadow"/></g>',
  S: '<g><path d="M12 108H43V116H12ZM85 108H116V116H85Z" class="cc-wall-top"/><path d="M12 99H43V108H12ZM85 99H116V108H85Z" class="cc-wall-face"/><path d="M44 108H84V116H44Z" class="cc-door-frame"/><path d="M49 110H79V114H49Z" class="cc-door-leaf"/><path d="M49 99L54 108H84L79 99Z" class="cc-door-shadow"/></g>',
  W: '<g><path d="M12 12H20V43H12ZM12 85H20V116H12Z" class="cc-wall-top"/><path d="M20 12H29V43H20ZM20 85H29V116H20Z" class="cc-wall-face"/><path d="M12 44H20V84H12Z" class="cc-door-frame"/><path d="M14 49H18V79H14Z" class="cc-door-leaf"/><path d="M20 49L29 54V84H20Z" class="cc-door-shadow"/></g>',
}

const floorDetails = `
  <g class="cc-floor-grid">
    <path d="M36 34L64 64L92 34 M36 94L64 64L92 94 M34 36L64 64L94 92 M94 36L64 64L34 92"/>
    <path d="M26 26L48 48 M102 26L80 48 M26 102L48 80 M102 102L80 80"/>
  </g>
  <g class="cc-paper">
    <path d="M33 36h9v12h-9z M35 39h5 M35 42h4"/>
    <path d="M88 83h10v12H88z M90 86h6 M90 89h5"/>
  </g>
  <g class="cc-blood">
    <rect x="76" y="39" width="4" height="4"/><rect x="80" y="43" width="4" height="4"/>
    <rect x="84" y="47" width="3" height="3"/><rect x="43" y="84" width="4" height="4"/>
    <rect x="39" y="88" width="3" height="3"/>
  </g>
  <g class="cc-debris">
    <rect x="93" y="32" width="4" height="3"/><rect x="31" y="76" width="3" height="3"/>
    <rect x="72" y="94" width="5" height="2"/>
  </g>
`

const getArtwork = (card: CorridorCard, turns: number) => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !exits.includes(direction))

  const arms = exits.map((direction) => `<polygon points="${floorArms[direction]}"/>`).join('')
  const walls = directionOrder
    .filter((direction) => !exits.includes(direction) && !doors.includes(direction))
    .map((direction) => wallMarkup[direction])
    .join('')
  const doorsMarkup = doors.map((direction) => doorMarkup[direction]).join('')

  return `
    <svg class="cc-card-art" viewBox="0 0 128 128" role="img" aria-label="Couloir, sorties : ${exits.join(', ') || 'aucune'}, portes : ${doors.length ? doors.join(', ') : 'aucune'}" shape-rendering="crispEdges">
      <path d="M8 8H120V120H8Z" class="cc-shadow"/>
      <path d="M12 12H116V116H12Z" class="cc-floor-base"/>
      <g class="cc-floor">
        <path d="M48 48H80V80H48Z"/>
        ${arms}
      </g>
      ${floorDetails}
      <g class="cc-walls">${walls}${doorsMarkup}</g>
      <g class="cc-center"><path d="M56 56H72V72H56Z"/><path d="M60 60H68V68H60Z"/></g>
      <g class="cc-openings">${exits.map((direction) => {
        const marks: Record<Direction, string> = {
          N: '<path d="M58 11H70V14H58Z"/>',
          E: '<path d="M114 58H117V70H114Z"/>',
          S: '<path d="M58 114H70V117H58Z"/>',
          W: '<path d="M11 58H14V70H11Z"/>',
        }
        return marks[direction]
      }).join('')}</g>
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
