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

const corridorArm: Record<Direction, string> = {
  N: '64,64 43,64 35,10 93,10 85,64',
  E: '64,64 64,43 118,35 118,93 64,85',
  S: '64,64 85,64 93,118 35,118 43,64',
  W: '64,64 64,85 10,93 10,35 64,43',
}

const edgeWalls: Record<Direction, { wall: string; door: string }> = {
  N: { wall: '<rect x="10" y="9" width="108" height="9"/>', door: '<rect x="52" y="8" width="24" height="4" class="cc-pixel-door-leaf"/>' },
  E: { wall: '<rect x="110" y="10" width="9" height="108"/>', door: '<rect x="116" y="52" width="4" height="24" class="cc-pixel-door-leaf"/>' },
  S: { wall: '<rect x="10" y="110" width="108" height="9"/>', door: '<rect x="52" y="116" width="24" height="4" class="cc-pixel-door-leaf"/>' },
  W: { wall: '<rect x="9" y="10" width="9" height="108"/>', door: '<rect x="8" y="52" width="4" height="24" class="cc-pixel-door-leaf"/>' },
}

const corners = [
  '<rect x="10" y="10" width="12" height="12" class="cc-pixel-corner"/>',
  '<rect x="106" y="10" width="12" height="12" class="cc-pixel-corner"/>',
  '<rect x="10" y="106" width="12" height="12" class="cc-pixel-corner"/>',
  '<rect x="106" y="106" width="12" height="12" class="cc-pixel-corner"/>',
].join('')

const floorDetails = `
  <g class="cc-pixel-floor-lines">
    <path d="M28 27H100 M28 101H100 M27 28V100 M101 28V100"/>
    <path d="M39 28V39 M89 89V100 M28 76H39 M89 52H100"/>
  </g>
  <g class="cc-pixel-paper">
    <path d="M27 39h10v13h-10z M29 42h6 M29 45h5 M29 48h4"/>
    <path d="M88 87h9v12h-9z M90 90h5 M90 93h4"/>
  </g>
  <g class="cc-pixel-blood">
    <rect x="77" y="35" width="4" height="4"/><rect x="81" y="39" width="4" height="4"/>
    <rect x="85" y="43" width="3" height="3"/><rect x="43" y="91" width="4" height="4"/>
    <rect x="39" y="95" width="3" height="3"/>
  </g>
  <g class="cc-pixel-debris">
    <rect x="95" y="29" width="4" height="3"/><rect x="31" y="83" width="3" height="3"/>
    <rect x="72" y="99" width="5" height="2"/><rect x="48" y="27" width="3" height="3"/>
  </g>
`

const getDoorMarkup = (direction: Direction) => {
  const horizontal = direction === 'N' || direction === 'S'
  const frame = horizontal
    ? '<rect x="48" y="8" width="4" height="12"/><rect x="76" y="8" width="4" height="12"/>'
    : '<rect x="8" y="48" width="12" height="4"/><rect x="8" y="76" width="12" height="4"/>'
  const sideWalls = horizontal
    ? '<rect x="10" y="9" width="38" height="9"/><rect x="80" y="9" width="38" height="9"/>'
    : '<rect x="110" y="10" width="9" height="38"/><rect x="110" y="80" width="9" height="38"/>'
  return `<g class="cc-pixel-door">${sideWalls}${frame}${edgeWalls[direction].door}<rect x="${horizontal ? 53 : 10}" y="${horizontal ? 13 : 53}" width="${horizontal ? 22 : 3}" height="${horizontal ? 3 : 22}" class="cc-pixel-threshold"/></g>`
}

const getArtwork = (card: CorridorCard, turns: number) => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !exits.includes(direction))

  const floorArms = exits.map((direction) => `<polygon points="${corridorArm[direction]}"/>`).join('')
  const walls = directionOrder
    .filter((direction) => !exits.includes(direction) && !doors.includes(direction))
    .map((direction) => edgeWalls[direction].wall)
    .join('')
  const doorways = doors.map(getDoorMarkup).join('')

  return `
    <svg class="cc-card-art" viewBox="0 0 128 128" role="img" aria-label="Couloir, sorties : ${exits.join(', ') || 'aucune'}, portes : ${doors.length ? doors.join(', ') : 'aucune'}" shape-rendering="crispEdges">
      <rect x="4" y="4" width="120" height="120" class="cc-pixel-shadow"/>
      <rect x="8" y="8" width="112" height="112" class="cc-pixel-room"/>
      <g class="cc-pixel-floor">
        <rect x="18" y="18" width="92" height="92"/>
        ${floorArms}
        <path d="M18 34H110 M18 64H110 M18 94H110 M34 18V110 M64 18V110 M94 18V110"/>
      </g>
      ${floorDetails}
      <g class="cc-pixel-wall">${walls}${doorways}${corners}</g>
      <g class="cc-pixel-center">
        <rect x="56" y="56" width="16" height="16"/>
        <rect x="60" y="60" width="8" height="8"/>
      </g>
      <g class="cc-pixel-exit-markers">${exits.map((direction) => {
        const positions: Record<Direction, string> = {
          N: '<rect x="58" y="9" width="12" height="3"/>',
          E: '<rect x="116" y="58" width="3" height="12"/>',
          S: '<rect x="58" y="116" width="12" height="3"/>',
          W: '<rect x="9" y="58" width="3" height="12"/>',
        }
        return positions[direction]
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
  const displayedDoors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !corridorDefinitions[card.kind].exits.map((exit) => rotateDirection(exit, turns)).includes(direction))
  const doorLabel = displayedDoors.length ? `Portes : ${displayedDoors.join(' / ')}` : 'Aucune porte'

  button.innerHTML = `<span class="cc-card-index">${String(index + 1).padStart(2, '0')}</span>${getArtwork(card, turns)}<span class="cc-card-name">${shapeLabel[card.kind]}<small>${doorLabel}</small></span>`
  button.addEventListener('click', onSelect)
  return button
}
