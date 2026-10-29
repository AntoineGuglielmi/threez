import * as THREE from 'three'
import './style.css'
import { createScene } from './scene'
import type { SurvivorKind } from './game/types'

let activeSurvivorKind: SurvivorKind = 'stealth'
const sceneSetup = createScene(activeSurvivorKind)
const { root, scene, camera, renderer, materials, board, start, activeRing, otherCharacters } = sceneSetup
let activeCharacter = sceneSetup.activeCharacter
type CorridorKind = 'straight' | 'left' | 'right' | 'tee' | 'cross'
type Direction = 'N' | 'E' | 'S' | 'W'
type CorridorCard = { id: number; kind: CorridorKind; doors: Direction[] }
type RoomStatus = 'ordinary' | 'locked' | 'trapped'
type RoomDifficulty = 'easy' | 'medium' | 'hard'
type ResourceType = 'cafe' | 'croissant' | 'citron' | 'bonbon' | 'munition'
type RoomRollResult = { resource: ResourceType; value: number; threshold: number; found: boolean }
type RoomCard = { id: number; status: RoomStatus; difficulty: RoomDifficulty; searched: boolean; unlocked: boolean }
type SavedRoom = RoomCard & { x: number; z: number; originX: number; originZ: number; direction: Direction; lastRoll?: RoomRollResult[] }
type RoomTile = SavedRoom & { group: THREE.Group }
type BoardTile = { x: number; z: number; kind: CorridorKind | 'start'; exits: Direction[]; doors: Direction[]; usedDoors: Direction[]; group: THREE.Group }
type PlacementOption = { exits: Direction[]; turns: number }
type PlacementCandidate = { x: number; z: number; options: PlacementOption[] }

type SavedGameState = {
  tiles: Array<{ x: number; z: number; kind: CorridorKind; exits: Direction[]; doors?: Direction[]; usedDoors?: Direction[] }>
  rooms?: SavedRoom[]
  currentRoomId?: number | null
  resources?: Record<ResourceType, number>
  roomDeck?: RoomCard[]
  pendingRoomDraw?: RoomCard | null
  nextRoomCardId?: number
  survivor: { x: number; z: number }
  survivors?: Partial<Record<SurvivorKind, { x: number; z: number; roomId: number | null }>>
  activeSurvivorKind?: SurvivorKind
  characterOrder?: SurvivorKind[]
  characterIndex?: number
  injuredMovedThisTurn?: boolean
  phase?: 'draw' | 'actions'
  survivorCards?: Partial<Record<SurvivorKind, { deck: CorridorCard[]; discard: CorridorCard[]; hand: CorridorCard[] }>>
  zoom: number
  cameraTarget: { x: number; z: number }
  cameraAngle?: number
  deck: CorridorCard[]
  discard: CorridorCard[]
  hand: CorridorCard[]
  pendingDraw: CorridorCard | null
  actionsRemaining: number
  turnNumber: number
  nextCardId: number
}
const STORAGE_KEY = 'threez-game-state-v1'
const readSavedGameState = (): SavedGameState | null => {
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
const savedGameState = readSavedGameState()

const directionOrder: Direction[] = ['N', 'E', 'S', 'W']
const corridorDefinitions: Record<CorridorKind, { label: string; symbol: string; exits: Direction[] }> = {
  straight: { label: 'Droit', symbol: '│', exits: ['N', 'S'] },
  left: { label: 'Virage gauche', symbol: '└', exits: ['N', 'W'] },
  right: { label: 'Virage droite', symbol: '┘', exits: ['N', 'E'] },
  tee: { label: 'Carrefour en T', symbol: '┬', exits: ['N', 'E', 'W'] },
  cross: { label: 'Carrefour en croix', symbol: '┼', exits: ['N', 'E', 'S', 'W'] },
}
const directionDelta: Record<Direction, [number, number]> = {
  N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0],
}
const opposite: Record<Direction, Direction> = { N: 'S', E: 'W', S: 'N', W: 'E' }
const rotateDirection = (direction: Direction, turns: number): Direction =>
  directionOrder[(directionOrder.indexOf(direction) + turns + 4) % 4]

let nextCardId = savedGameState?.nextCardId ?? 1
const getWallDirections = (kind: CorridorKind): Direction[] =>
  directionOrder.filter((direction) => !corridorDefinitions[kind].exits.includes(direction))

const createDoorDirections = (kind: CorridorKind, requestedCount = Math.floor(Math.random() * 3)): Direction[] => {
  const availableWalls = shuffle(getWallDirections(kind))
  return availableWalls.slice(0, Math.min(requestedCount, 2, availableWalls.length))
}

const createCard = (kind?: CorridorKind): CorridorCard => {
  const kinds = Object.keys(corridorDefinitions) as CorridorKind[]
  const cardKind = kind ?? kinds[Math.floor(Math.random() * kinds.length)]
  return { id: nextCardId++, kind: cardKind, doors: createDoorDirections(cardKind) }
}
const shuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

const createCorridorDeck = () => shuffle(
  (['straight', 'left', 'right', 'tee', 'cross'] as CorridorKind[])
    .flatMap((kind) => Array.from({ length: 8 }, () => createCard(kind))),
)
const normalizeSavedCard = (card: CorridorCard): CorridorCard => {
  const savedDoors = card.doors ?? []
  const validWallDoors = savedDoors.filter((direction) => getWallDirections(card.kind).includes(direction))
  return {
    ...card,
    doors: validWallDoors.length === savedDoors.length
      ? validWallDoors
      : createDoorDirections(card.kind, savedDoors.length),
  }
}
const roomStatuses: RoomStatus[] = ['ordinary', 'ordinary', 'ordinary', 'locked', 'trapped']
const roomDifficulties: RoomDifficulty[] = ['easy', 'medium', 'hard']
let nextRoomCardId = 1
const createRoomCard = (): RoomCard => {
  const status = roomStatuses[Math.floor(Math.random() * roomStatuses.length)]
  return {
    id: nextRoomCardId++,
    status,
    difficulty: roomDifficulties[Math.floor(Math.random() * roomDifficulties.length)],
    searched: false,
    unlocked: status !== 'locked',
  }
}
const generatedRoomDeck = shuffle(Array.from({ length: 24 }, createRoomCard))
const roomDeck: RoomCard[] = savedGameState?.roomDeck ?? generatedRoomDeck
let pendingRoomDraw: RoomCard | null = savedGameState?.pendingRoomDraw ?? null
const resources: Record<ResourceType, number> = {
  cafe: savedGameState?.resources?.cafe ?? 0,
  croissant: savedGameState?.resources?.croissant ?? 0,
  citron: savedGameState?.resources?.citron ?? 0,
  bonbon: savedGameState?.resources?.bonbon ?? 0,
  munition: savedGameState?.resources?.munition ?? 0,
}
const rooms: RoomTile[] = []
let currentRoomId: number | null = savedGameState?.currentRoomId ?? null
if (savedGameState?.nextRoomCardId) nextRoomCardId = savedGameState.nextRoomCardId
type SurvivorCards = { deck: CorridorCard[]; discard: CorridorCard[]; hand: CorridorCard[] }
const legacyOwner = savedGameState?.activeSurvivorKind ?? 'stealth'
const survivorCards = {} as Record<SurvivorKind, SurvivorCards>
for (const kind of ['stealth', 'heavy', 'military', 'scientist', 'injured'] as SurvivorKind[]) {
  const savedCards = savedGameState?.survivorCards?.[kind]
  if (savedCards) {
    survivorCards[kind] = {
      deck: savedCards.deck.map(normalizeSavedCard),
      discard: savedCards.discard.map(normalizeSavedCard),
      hand: savedCards.hand.map(normalizeSavedCard),
    }
  } else if (savedGameState && kind === legacyOwner) {
    survivorCards[kind] = {
      deck: savedGameState.deck.map(normalizeSavedCard),
      discard: savedGameState.discard.map(normalizeSavedCard),
      hand: savedGameState.hand.map(normalizeSavedCard),
    }
  } else {
    survivorCards[kind] = { deck: createCorridorDeck(), discard: [], hand: [] }
  }
}
let corridorDeck = survivorCards[legacyOwner].deck
let discardPile = survivorCards[legacyOwner].discard
let hand = survivorCards[legacyOwner].hand
let pendingDraw: CorridorCard | null = savedGameState?.pendingDraw ? normalizeSavedCard(savedGameState.pendingDraw) : null
let phase: 'draw' | 'actions' = savedGameState ? (savedGameState.phase ?? 'actions') : 'draw'
let selectedCardId: number | null = null
let selectedCardTurns = 0
let actionsRemaining = savedGameState?.actionsRemaining ?? 7
let turnNumber = savedGameState?.turnNumber ?? 1
if (savedGameState) nextCardId = savedGameState.nextCardId
if (savedGameState) {
  const highestCardId = Object.values(survivorCards).flatMap((cards) => [...cards.deck, ...cards.discard, ...cards.hand]).reduce((highest, card) => Math.max(highest, card.id), 0)
  nextCardId = Math.max(nextCardId, highestCardId + 1)
}
const boardTiles: BoardTile[] = [{
  x: 0,
  z: 0,
  kind: 'start',
  exits: ['S'],
  doors: [],
  usedDoors: [],
  group: start,
}]

let currentTile = boardTiles[0]
const characterModels: Record<SurvivorKind, THREE.Group> = {
  stealth: activeCharacter,
  heavy: otherCharacters.find((item) => item.kind === 'heavy')!.character,
  military: otherCharacters.find((item) => item.kind === 'military')!.character,
  scientist: otherCharacters.find((item) => item.kind === 'scientist')!.character,
  injured: otherCharacters.find((item) => item.kind === 'injured')!.character,
}
const survivorPositions: Record<SurvivorKind, { x: number; z: number; roomId: number | null }> = {
  stealth: { x: 0, z: 0, roomId: null },
  heavy: { x: 0, z: 0, roomId: null },
  military: { x: 0, z: 0, roomId: null },
  scientist: { x: 0, z: 0, roomId: null },
  injured: { x: 0, z: 0, roomId: null },
}
if (savedGameState?.survivors) {
  for (const kind of Object.keys(survivorPositions) as SurvivorKind[]) {
    const saved = savedGameState.survivors[kind]
    if (saved) survivorPositions[kind] = { ...saved }
  }
} else if (savedGameState?.survivor) {
  survivorPositions.stealth = { ...savedGameState.survivor, roomId: savedGameState.currentRoomId ?? null }
}
let characterOrder: SurvivorKind[] = savedGameState?.characterOrder ?? ['stealth', ...shuffle(['heavy', 'military', 'scientist'] as SurvivorKind[]), 'injured']
let characterIndex = savedGameState?.characterIndex ?? 0
let injuredMovedThisTurn = savedGameState?.injuredMovedThisTurn ?? false
if (savedGameState?.activeSurvivorKind && characterOrder.includes(savedGameState.activeSurvivorKind)) {
  activeSurvivorKind = savedGameState.activeSurvivorKind
  characterIndex = characterOrder.indexOf(activeSurvivorKind)
}
let placementPreview: { x: number; z: number; options: PlacementOption[]; optionIndex: number } | null = null
const placementHighlights = new THREE.Group()
placementHighlights.name = 'placement-highlights'
board.add(placementHighlights)
const roomPlacementHighlights = new THREE.Group()
roomPlacementHighlights.name = 'room-placement-highlights'
board.add(roomPlacementHighlights)
const ghostLayer = new THREE.Group()
ghostLayer.name = 'corridor-placement-ghost'
scene.add(ghostLayer)
let ghostTile: THREE.Group | null = null
const placementActions = document.querySelector<HTMLDivElement>('#placement-actions')
const rotateGhostButton = document.querySelector<HTMLButtonElement>('#rotate-ghost')
const confirmGhostButton = document.querySelector<HTMLButtonElement>('#confirm-ghost')

const handElement = document.querySelector<HTMLDivElement>('#cc-hand')
const deckCountElement = document.querySelector<HTMLElement>('#cc-deck-count')
const discardCountElement = document.querySelector<HTMLElement>('#cc-discard-count')
const actionsCountElement = document.querySelector<HTMLElement>('#actions-count')
const actionsFillElement = document.querySelector<HTMLDivElement>('#actions-fill')
const statusElement = document.querySelector<HTMLParagraphElement>('#game-status')
const drawButton = document.querySelector<HTMLButtonElement>('#draw-cc')
const placeButton = document.querySelector<HTMLButtonElement>('#place-cc')
const rotateButton = document.querySelector<HTMLButtonElement>('#rotate-cc')
const cancelPlacementButton = document.querySelector<HTMLButtonElement>('#cancel-placement')
const discardButton = document.querySelector<HTMLButtonElement>('#discard-cc')
const replaceButton = document.querySelector<HTMLButtonElement>('#replace-cc')
const endTurnButton = document.querySelector<HTMLButtonElement>('#end-turn')
const turnLabel = document.querySelector<HTMLElement>('.turn-tag')

const setStatus = (message: string) => {
  if (statusElement) statusElement.textContent = message
}

const findPlacement = (card: CorridorCard) => {
  const definition = corridorDefinitions[card.kind]
  for (const tile of boardTiles) {
    for (const exit of tile.exits) {
      const [dx, dz] = directionDelta[exit]
      const x = tile.x + dx
      const z = tile.z + dz
      if (boardTiles.some((placed) => placed.x === x && placed.z === z) || rooms.some((room) => room.x === x && room.z === z)) continue
      for (let turns = 0; turns < 4; turns += 1) {
        const exits = definition.exits.map((direction) => rotateDirection(direction, turns))
        if (!exits.includes(opposite[exit])) continue

        // Every side touching an existing tile must agree on whether a passage exists.
        const conflictsWithNeighbour = directionOrder.some((direction) => {
          const [nextX, nextZ] = directionDelta[direction]
          const neighbour = boardTiles.find((placed) => placed.x === x + nextX && placed.z === z + nextZ)
          if (!neighbour) return false
          return exits.includes(direction) !== neighbour.exits.includes(opposite[direction])
        })
        if (!conflictsWithNeighbour) return { x, z, exits, turns }
      }
    }
  }
  return null
}

const createCorridorTile = (card: CorridorCard, x: number, z: number, exits: Direction[], doors: Direction[] = [], usedDoors: Direction[] = []) => {
  const group = new THREE.Group()
  group.position.set(x * 1.18, 0.025, z * 1.18)
  // Exits are already rotated into board directions; build the walls in that orientation.

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 1.18), materials.start)
  base.position.y = 0.07
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const surface = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.025, 1.08), materials.startTop)
  surface.position.y = 0.152
  surface.receiveShadow = true
  group.add(surface)

  for (let px = -1; px <= 1; px += 1) {
    for (let pz = -1; pz <= 1; pz += 1) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.009, 0.32),
        (px + pz) % 2 === 0 ? materials.floorPanel : materials.floorPanelDark,
      )
      panel.position.set(px * 0.34, 0.169, pz * 0.34)
      panel.receiveShadow = true
      group.add(panel)
    }
  }

  const edgeSpecs: Array<{ direction: Direction; position: [number, number, number]; size: [number, number, number] }> = [
    { direction: 'N', position: [0, 0.31, -0.55], size: [1.08, 0.29, 0.055] },
    { direction: 'S', position: [0, 0.31, 0.55], size: [1.08, 0.29, 0.055] },
    { direction: 'E', position: [0.55, 0.31, 0], size: [0.055, 0.29, 1.08] },
    { direction: 'W', position: [-0.55, 0.31, 0], size: [0.055, 0.29, 1.08] },
  ]
  for (const edge of edgeSpecs) {
    if (exits.includes(edge.direction)) continue
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...edge.size), materials.corridorWall)
    wall.position.set(...edge.position)
    wall.castShadow = true
    wall.receiveShadow = true
    group.add(wall)
  }

  for (const direction of doors.filter((item) => !exits.includes(item))) {
    const horizontal = direction === 'N' || direction === 'S'
    const edgeOffset = direction === 'N' ? -0.51 : direction === 'S' ? 0.51 : direction === 'W' ? -0.51 : 0.51
    const door = new THREE.Group()
    door.userData.doorDirection = direction
    door.visible = !usedDoors.includes(direction)
    door.position.set(horizontal ? 0 : edgeOffset, 0, horizontal ? edgeOffset : 0)
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 0.48 : 0.045, 0.235, horizontal ? 0.045 : 0.48),
      new THREE.MeshStandardMaterial({ color: '#79513f', metalness: 0.62, roughness: 0.48 }),
    )
    panel.position.y = 0.31
    panel.castShadow = true
    panel.receiveShadow = true
    door.add(panel)

    const frameMaterial = new THREE.MeshStandardMaterial({ color: '#aab5bd', metalness: 0.8, roughness: 0.32 })
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 0.035 : 0.065, 0.29, horizontal ? 0.065 : 0.035),
        frameMaterial,
      )
      post.position.set(horizontal ? side * 0.27 : 0, 0.31, horizontal ? 0 : side * 0.27)
      door.add(post)
    }
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 0.58 : 0.065, 0.035, horizontal ? 0.065 : 0.58),
      frameMaterial,
    )
    lintel.position.y = 0.465
    door.add(lintel)

    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#e5b16c', metalness: 0.6, roughness: 0.35 }),
    )
    handle.position.set(horizontal ? 0.16 : 0, 0.31, horizontal ? 0 : 0.16)
    door.add(handle)
    group.add(door)
  }

  for (const direction of exits) {
    const [dx, dz] = directionDelta[direction]
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(dx === 0 ? 0.76 : 0.035, 0.012, dz === 0 ? 0.76 : 0.035),
      materials.tileNeon,
    )
    strip.position.set(dx * 0.43, 0.18, dz * 0.43)
    group.add(strip)
  }

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.025, 0.12),
    new THREE.MeshBasicMaterial({ color: card.kind === 'cross' ? '#bd7958' : '#75d9ff' }),
  )
  marker.position.set(0, 0.19, 0)
  group.add(marker)
  board.add(group)
  return group
}


const createRoomTile = (room: SavedRoom, entryDirection: Direction) => {
  const group = new THREE.Group()
  group.position.set(room.x * 1.18, 0.025, room.z * 1.18)

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.14, 1.18),
    new THREE.MeshStandardMaterial({ color: '#382d29', roughness: 0.92 }),
  )
  base.position.y = 0.07
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.025, 1.08),
    new THREE.MeshStandardMaterial({
      color: room.searched ? '#45464a' : '#494039',
      emissive: room.searched ? '#101719' : '#25160d',
      emissiveIntensity: 0.35,
      roughness: 0.88,
    }),
  )
  surface.position.y = 0.152
  surface.receiveShadow = true
  group.add(surface)

  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.009, 0.32),
        (x + z) % 2 === 0 ? materials.floorPanelDark : materials.floorPanel,
      )
      panel.position.set(x * 0.34, 0.169, z * 0.34)
      group.add(panel)
    }
  }

  const edges: Array<{ direction: Direction; position: [number, number, number]; size: [number, number, number] }> = [
    { direction: 'N', position: [0, 0.31, -0.55], size: [1.08, 0.29, 0.055] },
    { direction: 'S', position: [0, 0.31, 0.55], size: [1.08, 0.29, 0.055] },
    { direction: 'E', position: [0.55, 0.31, 0], size: [0.055, 0.29, 1.08] },
    { direction: 'W', position: [-0.55, 0.31, 0], size: [0.055, 0.29, 1.08] },
  ]
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: '#55463d',
    metalness: 0.18,
    roughness: 0.9,
  })
  for (const edge of edges) {
    if (edge.direction === entryDirection) continue
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...edge.size), wallMaterial)
    wall.position.set(...edge.position)
    wall.castShadow = true
    wall.receiveShadow = true
    group.add(wall)
  }

  const entry = edges.find((edge) => edge.direction === entryDirection)
  if (entry) {
    const horizontal = entryDirection === 'N' || entryDirection === 'S'
    const frameMaterial = new THREE.MeshStandardMaterial({ color: '#b27c52', metalness: 0.58, roughness: 0.45 })
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 0.045 : 0.07, 0.29, horizontal ? 0.07 : 0.045),
        frameMaterial,
      )
      post.position.set(horizontal ? side * 0.28 : entry.position[0], 0.31, horizontal ? entry.position[2] : side * 0.28)
      group.add(post)
    }
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 0.6 : 0.07, 0.04, horizontal ? 0.07 : 0.6),
      frameMaterial,
    )
    lintel.position.set(horizontal ? 0 : entry.position[0], 0.47, horizontal ? entry.position[2] : 0)
    group.add(lintel)
  }

  const markerColor = room.status === 'locked' ? '#bd7958' : room.status === 'trapped' ? '#e0a45d' : '#75d9ff'
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.025, 0.18),
    new THREE.MeshBasicMaterial({ color: markerColor }),
  )
  marker.position.set(0, 0.19, 0)
  group.add(marker)

  if (!room.searched) {
    const glow = new THREE.PointLight(markerColor, 0.65, 1.8, 1.8)
    glow.position.set(0, 0.42, 0)
    group.add(glow)
  }

  board.add(group)
  return group
}

const getSurvivorLabel = (kind: SurvivorKind) => ({
  stealth: 'Furtif', heavy: 'Costaud', military: 'Militaire', scientist: 'Scientifique', injured: 'Blessé',
})[kind]

const getRoomStatusLabel = (status: RoomStatus) => ({
  ordinary: 'Ordinaire',
  locked: 'Verrouillée',
  trapped: 'Piégée',
})[status]

const getDifficultyLabel = (difficulty: RoomDifficulty) => ({
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Difficile',
})[difficulty]

const resourceLabels: Record<ResourceType, string> = {
  cafe: 'Café',
  croissant: 'Croissant',
  citron: 'Citron',
  bonbon: 'Bonbon acidulé',
  munition: 'Munition',
}

const resourceThresholds: Record<RoomDifficulty, Record<ResourceType, number>> = {
  easy: { cafe: 4, croissant: 3, citron: 4, bonbon: 3, munition: 4 },
  medium: { cafe: 5, croissant: 4, citron: 5, bonbon: 4, munition: 5 },
  hard: { cafe: 6, croissant: 5, citron: 6, bonbon: 5, munition: 6 },
}

const rollRoomDice = (room: RoomTile) => {
  const dice = Object.keys(resourceLabels) as ResourceType[]
  const results = dice.map((resource) => ({
    resource,
    value: Math.floor(Math.random() * 6) + 1,
    threshold: resourceThresholds[room.difficulty][resource],
  }))
  const found = results.filter((result) => result.value >= result.threshold)
  found.forEach(({ resource }) => { resources[resource] += 1 })
  room.lastRoll = results.map((result) => ({ ...result, found: result.value >= result.threshold }))
  room.searched = true
  setStatus(found.length
    ? `Fouille ${getDifficultyLabel(room.difficulty).toLowerCase()} : ${results.map((result) => `${resourceLabels[result.resource]} ${result.value}/6`).join(' · ')}. Trouvé : ${found.map(({ resource }) => resourceLabels[resource]).join(', ')}.`
    : `Fouille ${getDifficultyLabel(room.difficulty).toLowerCase()} : ${results.map((result) => `${resourceLabels[result.resource]} ${result.value}/6`).join(' · ')}. Aucune ressource trouvée.`)
  saveGameState()
  renderGameUi()
}

// Setup: two straight corridor cards are placed between the start tile and the unexplored area.
const setupCorridor = () => {
  for (let index = 1; index <= 2; index += 1) {
    const deckIndex = corridorDeck.findIndex((card) => card.kind === 'straight')
    if (deckIndex < 0) throw new Error('Not enough straight corridor cards for setup')
    const [card] = corridorDeck.splice(deckIndex, 1)
    const x = 0
    const z = index
    const exits: Direction[] = ['N', 'S']
    const doors: Direction[] = []
    const group = createCorridorTile(card, x, z, exits, doors)
    boardTiles.push({ x, z, kind: card.kind, exits, doors, usedDoors: [], group })
  }
}

if (savedGameState?.tiles.length) {
  for (const tile of savedGameState.tiles) {
    const isInitialCorridor = tile.x === 0 && (tile.z === 1 || tile.z === 2)
    const savedDoors = isInitialCorridor ? [] : tile.doors ?? []
    const validWallDoors = savedDoors.filter((direction) => !tile.exits.includes(direction))
    const doors = validWallDoors.length === savedDoors.length
      ? validWallDoors
      : createDoorDirections(tile.kind, savedDoors.length)
    const card: CorridorCard = { id: nextCardId++, kind: tile.kind, doors }
    const usedDoors = [...(tile.usedDoors ?? [])]
    const group = createCorridorTile(card, tile.x, tile.z, tile.exits, doors, usedDoors)
    boardTiles.push({ ...tile, exits: [...tile.exits], doors: [...doors], usedDoors, group })
  }
} else {
  setupCorridor()
}


if (savedGameState?.rooms) {
  for (const savedRoom of savedGameState.rooms) {
    const group = createRoomTile(savedRoom, opposite[savedRoom.direction])
    rooms.push({ ...savedRoom, group })
  }
}
if (savedGameState?.nextRoomCardId) nextRoomCardId = savedGameState.nextRoomCardId

const getSurvivorTokenPosition = (kind: SurvivorKind): [number, number, number] => ({
  stealth: [0, 0.19, 0.16],
  heavy: [-0.32, 0.19, -0.28],
  military: [0.32, 0.19, -0.28],
  scientist: [-0.32, 0.19, 0.36],
  injured: [0.32, 0.19, 0.36],
})[kind]

const placeSurvivorModel = (kind: SurvivorKind, makeActive: boolean) => {
  const model = characterModels[kind]
  model.parent?.remove(model)
  model.scale.setScalar(makeActive ? 0.72 : 0.27)
  const position = survivorPositions[kind]
  const tile = boardTiles.find((item) => item.x === position.x && item.z === position.z) ?? boardTiles[0]
  const room = position.roomId === null ? null : rooms.find((item) => item.id === position.roomId) ?? null
  const parent = room?.group ?? tile.group
  parent.add(model)
  const [offsetX, , offsetZ] = makeActive ? [0, 0.19, room ? 0 : 0.16] : getSurvivorTokenPosition(kind)
  model.position.set(offsetX, 0.19, offsetZ)
  if (makeActive) {
    parent.add(activeRing, characterKeyLight, characterFillLight, warmRimLight)
    activeRing.position.set(0, 0.183, room ? 0 : 0.16)
  }
  return { tile, room }
}

const activateSurvivor = (kind: SurvivorKind) => {
  survivorCards[activeSurvivorKind] = { deck: corridorDeck, discard: discardPile, hand }
  const previousKind = activeSurvivorKind
  const previousModel = characterModels[previousKind]
  const previousPosition = survivorPositions[previousKind]
  const previousTile = boardTiles.find((tile) => tile.x === previousPosition.x && tile.z === previousPosition.z) ?? currentTile
  const previousRoom = previousPosition.roomId === null ? null : rooms.find((room) => room.id === previousPosition.roomId) ?? null
  previousModel.parent?.remove(previousModel, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  previousModel.scale.setScalar(0.27)
  ;(previousRoom?.group ?? previousTile.group).add(previousModel)
  const [previousX, , previousZ] = getSurvivorTokenPosition(previousKind)
  previousModel.position.set(previousX, 0.19, previousRoom ? 0 : previousZ)

  activeSurvivorKind = kind
  corridorDeck = survivorCards[kind].deck
  discardPile = survivorCards[kind].discard
  hand = survivorCards[kind].hand
  activeCharacter = characterModels[kind]
  const restored = placeSurvivorModel(kind, true)
  currentTile = restored.tile
  currentRoomId = restored.room?.id ?? null
}

for (const kind of Object.keys(characterModels) as SurvivorKind[]) {
  if (kind !== activeSurvivorKind) placeSurvivorModel(kind, false)
}
activateSurvivor(activeSurvivorKind)

const getPlacements = (card: CorridorCard, fixedTurns = selectedCardTurns): PlacementCandidate[] => {
  const candidates = new Map<string, PlacementCandidate>()
  const definition = corridorDefinitions[card.kind]

  for (const tile of boardTiles) {
    for (const exit of tile.exits) {
      const [dx, dz] = directionDelta[exit]
      const x = tile.x + dx
      const z = tile.z + dz
      if (boardTiles.some((placed) => placed.x === x && placed.z === z) || rooms.some((room) => room.x === x && room.z === z)) continue

      const key = `${x},${z}`
      const candidate = candidates.get(key) ?? { x, z, options: [] }
      const exits = definition.exits.map((direction) => rotateDirection(direction, fixedTurns))
      if (!exits.includes(opposite[exit])) continue

      // Every side touching an existing tile must agree on whether a passage exists.
      const conflictsWithNeighbour = directionOrder.some((direction) => {
        const [nextX, nextZ] = directionDelta[direction]
        const neighbour = boardTiles.find((placed) => placed.x === x + nextX && placed.z === z + nextZ)
        if (!neighbour) return false
        return exits.includes(direction) !== neighbour.exits.includes(opposite[direction])
      })
      if (conflictsWithNeighbour) continue

      const signature = directionOrder.filter((direction) => exits.includes(direction)).join('')
      if (!candidate.options.some((option) => directionOrder.filter((direction) => option.exits.includes(direction)).join('') === signature)) {
        candidate.options.push({ exits, turns: fixedTurns })
      }
      if (candidate.options.length > 0) candidates.set(key, candidate)
    }
  }

  return [...candidates.values()]
}

const disposeGroup = (group: THREE.Group) => {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    meshMaterials.forEach((material) => material.dispose())
  })
  group.clear()
}

const clearGhostTile = () => {
  if (ghostTile) {
    ghostLayer.remove(ghostTile)
    disposeGroup(ghostTile)
    ghostTile = null
  }
  if (placementActions) placementActions.hidden = true
}

const createGhostTile = () => {
  clearGhostTile()
  if (!placementPreview || selectedCardId === null) return
  const card = hand.find((item) => item.id === selectedCardId)
  if (!card) return
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, selectedCardTurns))
  const doors = card.doors.map((direction) => rotateDirection(direction, selectedCardTurns))
  const ghost = createCorridorTile(card, placementPreview.x, placementPreview.z, exits, doors)
  board.remove(ghost)
  ghost.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = false
    object.receiveShadow = false
    const originalMaterial = object.material
    const sourceMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial]
    const ghostMaterials = sourceMaterials.map((source) => {
      const material = source.clone()
      material.transparent = true
      material.opacity = 0.48
      material.depthWrite = false
      return material
    })
    object.material = Array.isArray(originalMaterial) ? ghostMaterials : ghostMaterials[0]
  })
  ghostTile = ghost
  ghostLayer.add(ghost)
  if (placementActions) placementActions.hidden = false
}

const updatePlacementHighlights = () => {
  disposeGroup(placementHighlights)
  disposeGroup(roomPlacementHighlights)

  if (phase === 'actions' && selectedCardId !== null && !pendingDraw && activeSurvivorKind !== 'injured') {
    const card = hand.find((item) => item.id === selectedCardId)
    if (card) {
      for (const candidate of getPlacements(card, selectedCardTurns)) {
        const isSelected = placementPreview?.x === candidate.x && placementPreview?.z === candidate.z
        const marker = new THREE.Group()
        marker.name = 'placement-marker'
        marker.userData.isPlacementMarker = true
        marker.userData.placementX = candidate.x
        marker.userData.placementZ = candidate.z
        marker.position.set(candidate.x * 1.18, 0.19, candidate.z * 1.18)

        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 0.94),
          new THREE.MeshBasicMaterial({
            color: isSelected ? '#75d9ff' : '#4b9cb5',
            transparent: true,
            opacity: isSelected ? 0.2 : 0.09,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        )
        pad.rotation.x = -Math.PI / 2
        marker.add(pad)
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(isSelected ? 0.39 : 0.34, isSelected ? 0.43 : 0.37, 4),
          new THREE.MeshBasicMaterial({
            color: isSelected ? '#bcefff' : '#75d9ff',
            transparent: true,
            opacity: isSelected ? 1 : 0.72,
            side: THREE.DoubleSide,
          }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.006
        marker.add(ring)

        for (const direction of candidate.options[0]?.exits ?? []) {
          const [dx, dz] = directionDelta[direction]
          const exitMarker = new THREE.Mesh(
            new THREE.BoxGeometry(dx === 0 ? 0.22 : 0.055, 0.018, dz === 0 ? 0.22 : 0.055),
            new THREE.MeshBasicMaterial({ color: '#75d9ff' }),
          )
          exitMarker.position.set(dx * 0.43, 0.02, dz * 0.43)
          marker.add(exitMarker)
        }
        for (const direction of card.doors.map((item) => rotateDirection(item, selectedCardTurns)).filter((item) => !candidate.options[0]?.exits.includes(item))) {
          const [dx, dz] = directionDelta[direction]
          const doorMarker = new THREE.Mesh(
            new THREE.BoxGeometry(dx === 0 ? 0.22 : 0.055, 0.018, dz === 0 ? 0.22 : 0.055),
            new THREE.MeshBasicMaterial({ color: '#f0b17a' }),
          )
          doorMarker.position.set(dx * 0.43, 0.024, dz * 0.43)
          marker.add(doorMarker)
        }
        placementHighlights.add(marker)
      }
    }
  }

  if (pendingRoomDraw && currentRoomId === null && activeSurvivorKind !== 'injured') {
    for (const direction of getAvailableDoors()) {
      const [dx, dz] = directionDelta[direction]
      const marker = new THREE.Group()
      marker.name = 'room-placement-marker'
      marker.userData.isRoomPlacementMarker = true
      marker.userData.roomPlacementDirection = direction
      marker.position.set((currentTile.x + dx) * 1.18, 0.19, (currentTile.z + dz) * 1.18)
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 0.94),
        new THREE.MeshBasicMaterial({ color: '#d99a75', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      )
      pad.rotation.x = -Math.PI / 2
      marker.add(pad)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.34, 0.4, 4),
        new THREE.MeshBasicMaterial({ color: '#f0b17a', side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.006
      marker.add(ring)
      roomPlacementHighlights.add(marker)
    }
  }

  createGhostTile()
}
const spendAction = () => {
  actionsRemaining = Math.max(0, actionsRemaining - 1)
  if (actionsRemaining === 0) setStatus('Plus d’actions. Terminez le tour pour continuer.')
}

const confirmPlacement = () => {
  if (phase !== 'actions') return
  const card = hand.find((item) => item.id === selectedCardId)
  if (!card || !placementPreview) return
  const { x, z } = placementPreview
  const validCandidate = getPlacements(card, selectedCardTurns).find((candidate) => candidate.x === x && candidate.z === z)
  if (!validCandidate || boardTiles.some((tile) => tile.x === x && tile.z === z)) {
    setStatus('Cette orientation ne convient pas à cet emplacement. Tournez la carte ou choisissez un autre emplacement.')
    return
  }

  const doors = card.doors.map((direction) => rotateDirection(direction, selectedCardTurns))
  const exits = validCandidate.options[0].exits
  const group = createCorridorTile(card, x, z, exits, doors)
  const placedTile: BoardTile = { x, z, kind: card.kind, exits, doors, usedDoors: [], group }
  boardTiles.push(placedTile)

  hand = hand.filter((item) => item.id !== card.id)
  selectedCardId = null
  placementPreview = null
  clearGhostTile()
  setStatus('Couloir posé. Le déplacement reste à effectuer séparément.')
  saveGameState()
  renderGameUi()
}

const refillHand = () => {
  if (phase !== 'draw' || activeSurvivorKind === 'injured') return
  let drawn = 0
  while (hand.length < 3) {
    if (corridorDeck.length === 0 && discardPile.length > 0) {
      corridorDeck.push(...shuffle(discardPile.splice(0, discardPile.length)))
    }
    const card = corridorDeck.pop()
    if (!card) break
    hand.push(card)
    drawn += 1
  }
  phase = 'actions'
  selectedCardId = null
  placementPreview = null
  pendingDraw = null
  setStatus(drawn > 0
    ? `Main complétée : ${drawn} carte${drawn > 1 ? 's' : ''} piochée${drawn > 1 ? 's' : ''}. Phase d’actions.`
    : 'Phase d’actions : votre main contient déjà 3 couloirs, ou la pioche est épuisée.')
  saveGameState()
  renderGameUi()
}


const roomDoorOptionsElement = document.querySelector<HTMLDivElement>('#cp-door-options')
const roomDeckCountElement = document.querySelector<HTMLElement>('#cp-deck-count')
const drawRoomButton = document.querySelector<HTMLButtonElement>('#draw-cp')
const roomStateElement = document.querySelector<HTMLElement>('#room-state')
const roomResultElement = document.querySelector<HTMLDivElement>('#room-result')
const unlockRoomButton = document.querySelector<HTMLButtonElement>('#unlock-room')
const returnRoomButton = document.querySelector<HTMLButtonElement>('#return-room')

const getAvailableDoors = () => currentTile.doors.filter((direction) => {
  if (currentTile.usedDoors.includes(direction)) return false
  const [dx, dz] = directionDelta[direction]
  const x = currentTile.x + dx
  const z = currentTile.z + dz
  return !boardTiles.some((tile) => tile.x === x && tile.z === z) &&
    !rooms.some((room) => room.x === x && room.z === z)
})

const drawRoomCard = () => {
  if (activeSurvivorKind === 'injured' || currentRoomId !== null || pendingRoomDraw) return
  const availableDoors = getAvailableDoors()
  if (availableDoors.length === 0) {
    setStatus('Aucune porte libre pour placer une nouvelle pièce.')
    return
  }
  const card = roomDeck.pop()
  if (!card) {
    setStatus('La pioche de pièces est vide.')
    renderGameUi()
    return
  }
  pendingRoomDraw = card
  selectedCardId = null
  placementPreview = null
  setStatus('Pièce piochée. Choisissez un emplacement lumineux sur le plateau.')
  saveGameState()
  renderGameUi()
}

const placeDrawnRoom = (direction: Direction) => {
  if (!pendingRoomDraw || currentRoomId !== null) return
  if (!getAvailableDoors().includes(direction)) return
  const [dx, dz] = directionDelta[direction]
  const x = currentTile.x + dx
  const z = currentTile.z + dz
  const card = pendingRoomDraw
  const room: SavedRoom = { ...card, x, z, originX: currentTile.x, originZ: currentTile.z, direction }
  const group = createRoomTile(room, opposite[direction])
  rooms.push({ ...room, group })
  currentTile.usedDoors.push(direction)
  const doorMesh = currentTile.group.children.find((child) => child.userData.doorDirection === direction)
  if (doorMesh) doorMesh.visible = false
  pendingRoomDraw = null
  setStatus('Pièce posée. Cliquez dessus pour y entrer.')
  saveGameState()
  renderGameUi()
}

const unlockCurrentRoom = () => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId === null || actionsRemaining <= 0) return
  const room = rooms.find((item) => item.id === currentRoomId)
  if (!room || room.status !== 'locked' || room.unlocked) return
  room.unlocked = true
  spendAction()
  setStatus('Porte déverrouillée. Vous pouvez maintenant la fouiller.')
  saveGameState()
  renderGameUi()
}

const searchCurrentRoomAgain = () => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId === null || actionsRemaining <= 0) return
  const room = rooms.find((item) => item.id === currentRoomId)
  if (!room || (room.status === 'locked' && !room.unlocked)) return
  if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Pièce piégée : seul le survivant furtif peut la fouiller.')
    return
  }

  spendAction()
  setStatus('Nouvelle fouille en cours…')
  rollRoomDice(room)
}

const returnToCorridor = () => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId === null || actionsRemaining <= 0) return
  currentTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeRing.position.set(0, 0.183, 0.16)
  currentRoomId = null
  survivorPositions[activeSurvivorKind].roomId = null
  spendAction()
  setStatus('Retour dans le couloir.')
  saveGameState()
  renderGameUi()
}

const enterRoom = (room: RoomTile) => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId !== null) return
  if (room.originX !== currentTile.x || room.originZ !== currentTile.z) return
  if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Pièce piégée : seul le Furtif peut y entrer.')
    return
  }

  if (actionsRemaining <= 0) {
    setStatus('Il ne reste plus d’action pour entrer dans une pièce.')
    return
  }
  currentRoomId = room.id
  survivorPositions[activeSurvivorKind] = { x: currentTile.x, z: currentTile.z, roomId: room.id }
  spendAction()
  currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  room.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0)
  activeRing.position.set(0, 0.183, 0)
  selectedCardId = null
  placementPreview = null

  if (room.status === 'locked' && !room.unlocked) {
    setStatus('Vous entrez dans une pièce verrouillée. Déverrouillez-la pour la fouiller.')
  } else if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Vous entrez dans une pièce piégée. Seul le survivant furtif peut la fouiller.')
  } else {
    setStatus(room.searched
      ? 'Vous entrez dans une pièce déjà fouillée. Vous pouvez la fouiller à nouveau.'
      : 'Vous entrez dans la pièce. Fouillez-la quand vous êtes prêt.')
  }
  saveGameState()
  renderGameUi()
}

const renderRoomControls = () => {
  if (roomDeckCountElement) roomDeckCountElement.textContent = String(roomDeck.length)
  if (!roomDoorOptionsElement || !roomStateElement) return
  roomDoorOptionsElement.replaceChildren()
  const currentRoom = currentRoomId === null ? null : rooms.find((room) => room.id === currentRoomId) ?? null
  if (drawRoomButton) {
    drawRoomButton.disabled = phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId !== null || getAvailableDoors().length === 0 || roomDeck.length === 0 || pendingRoomDraw !== null
    drawRoomButton.textContent = pendingRoomDraw ? 'Choisir un emplacement' : 'Piocher une pièce'
  }
  if (roomResultElement) roomResultElement.replaceChildren()
  if (currentRoom) {
    if (roomResultElement && currentRoom.lastRoll) {
      const resultHeading = document.createElement('strong')
      resultHeading.className = 'room-result-heading'
      resultHeading.textContent = 'Dernière fouille'
      const diceGrid = document.createElement('div')
      diceGrid.className = 'room-dice-results'
      currentRoom.lastRoll.forEach((result) => {
        const die = document.createElement('div')
        die.className = `room-die-result${result.found ? ' is-found' : ''}`
        const name = document.createElement('span')
        name.textContent = resourceLabels[result.resource]
        const value = document.createElement('strong')
        value.textContent = String(result.value)
        const threshold = document.createElement('small')
        threshold.textContent = `Seuil ${result.threshold}+`
        die.append(name, value, threshold)
        diceGrid.append(die)
      })
      roomResultElement.append(resultHeading, diceGrid)
      const foundResources = currentRoom.lastRoll.filter((result) => result.found)
      const loot = document.createElement('p')
      loot.className = 'room-result-loot'
      loot.textContent = foundResources.length
        ? `Trouvé : ${foundResources.map((result) => resourceLabels[result.resource]).join(', ')}`
        : 'Aucune ressource trouvée'
      roomResultElement.append(loot)
    }
    const statusLabel = currentRoom.status === 'locked' && currentRoom.unlocked ? 'Déverrouillée' : getRoomStatusLabel(currentRoom.status)
    roomStateElement.textContent = `Pièce ${String(currentRoom.id).padStart(2, '0')} · ${statusLabel} · ${getDifficultyLabel(currentRoom.difficulty)}${currentRoom.searched ? ' · Déjà fouillée' : ''}`
    if (unlockRoomButton) {
      unlockRoomButton.hidden = currentRoom.status !== 'locked' || currentRoom.unlocked
      unlockRoomButton.disabled = phase !== 'actions' || actionsRemaining <= 0
    }
    if (returnRoomButton) {
      returnRoomButton.hidden = false
      returnRoomButton.disabled = phase !== 'actions' || actionsRemaining <= 0
    }
    if (currentRoom.status === 'locked' && !currentRoom.unlocked) {
      roomDoorOptionsElement.textContent = 'Porte verrouillée'
    } else if (currentRoom.status === 'trapped' && activeSurvivorKind !== 'stealth') {
      roomDoorOptionsElement.textContent = 'Piège : seul le survivant furtif peut fouiller cette pièce.'
    } else {
      const searchButton = document.createElement('button')
      searchButton.type = 'button'
      searchButton.className = 'action-button primary'
      searchButton.disabled = phase !== 'actions' || actionsRemaining <= 0
      searchButton.textContent = currentRoom.searched ? 'Fouiller à nouveau · 1 action' : 'Fouiller · 1 action'
      searchButton.addEventListener('click', searchCurrentRoomAgain)
      roomDoorOptionsElement.append(searchButton)
    }
    return
  }

  if (unlockRoomButton) unlockRoomButton.hidden = true
  if (returnRoomButton) returnRoomButton.hidden = true
  const adjacentRooms = rooms.filter((room) => room.originX === currentTile.x && room.originZ === currentTile.z)
  const availableDoors = getAvailableDoors()

  if (adjacentRooms.length > 0) {
    roomStateElement.textContent = adjacentRooms.length === 1 ? 'Pièce adjacente' : 'Pièces adjacentes'
    adjacentRooms.forEach((room) => {
      const card = document.createElement('div')
      card.className = 'room-property-card'
      const statusLabel = room.status === 'locked' && room.unlocked ? 'Déverrouillée' : getRoomStatusLabel(room.status)
      const heading = document.createElement('strong')
      heading.textContent = `Pièce ${String(room.id).padStart(2, '0')}`
      const properties = document.createElement('span')
      properties.textContent = `${statusLabel} · ${getDifficultyLabel(room.difficulty)} · ${room.searched ? 'Déjà fouillée' : 'Non fouillée'}`
      card.append(heading, properties)
      const enterButton = document.createElement('button')
      enterButton.type = 'button'
      enterButton.className = 'action-button primary'
      enterButton.disabled = phase !== 'actions' || actionsRemaining <= 0
      enterButton.textContent = 'Entrer dans la pièce'
      enterButton.addEventListener('click', () => enterRoom(room))
      card.append(enterButton)
      roomDoorOptionsElement.append(card)
    })
  } else {
    roomStateElement.textContent = 'Aucune pièce à proximité'
  }

  if (pendingRoomDraw) {
    const note = document.createElement('p')
    note.className = 'room-draw-prompt'
    note.textContent = 'Pièce piochée : cliquez sur un emplacement lumineux du plateau.'
    roomDoorOptionsElement.append(note)
  }

  if (adjacentRooms.length === 0 && availableDoors.length === 0 && !pendingRoomDraw) {
    roomDoorOptionsElement.textContent = currentTile.doors.length
      ? 'Aucune porte inutilisée'
      : 'Aucune porte sur ce couloir'
  }
}

const renderGameUi = () => {
  survivorCards[activeSurvivorKind] = { deck: corridorDeck, discard: discardPile, hand }
  updatePlacementHighlights()
  if (!handElement || !deckCountElement || !discardCountElement || !actionsCountElement || !actionsFillElement) return
  handElement.replaceChildren()
  hand.forEach((card, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `cc-card${selectedCardId === card.id ? ' is-selected' : ''}`
    button.disabled = phase !== 'actions' || Boolean(pendingDraw) || activeSurvivorKind === 'injured'
    button.setAttribute('aria-pressed', String(selectedCardId === card.id))
    const cardTurns = selectedCardId === card.id ? selectedCardTurns : 0
    const exits = corridorDefinitions[card.kind].exits
    const edgeLines: Record<Direction, string> = {
      N: '<path d="M20 12H80" />',
      E: '<path d="M88 20V80" />',
      S: '<path d="M20 88H80" />',
      W: '<path d="M12 20V80" />',
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
        return `<path d="${ends[direction]}" />`
      })
      .join('')
    const doorRects: Record<Direction, string> = {
      N: '<rect x="43" y="9" width="14" height="6" rx="1" />',
      E: '<rect x="85" y="43" width="6" height="14" rx="1" />',
      S: '<rect x="43" y="85" width="14" height="6" rx="1" />',
      W: '<rect x="9" y="43" width="6" height="14" rx="1" />',
    }
    const doorMarkup = card.doors.filter((direction) => !exits.includes(direction)).map((direction) => doorRects[direction]).join('')
    const rotatedArtwork = cardTurns === 0 ? '' : ` transform="rotate(${cardTurns * 90} 50 50)"`
    const displayedDoors = card.doors
      .filter((direction) => !exits.includes(direction))
      .map((direction) => rotateDirection(direction, cardTurns))
    const doorLabel = displayedDoors.length ? `Portes : ${displayedDoors.join(' / ')}` : 'Aucune porte'
    const shapeLabel: Record<CorridorKind, string> = {
      straight: 'Couloir droit',
      left: 'Couloir avec virage',
      right: 'Couloir avec virage',
      tee: 'Couloir en T',
      cross: 'Carrefour',
    }
    button.innerHTML = `<span class="cc-card-index">${String(index + 1).padStart(2, '0')}</span><svg class="cc-card-art" viewBox="0 0 100 100" role="img" aria-label="${shapeLabel[card.kind]}, ${displayedDoors.length ? displayedDoors.join(', ') : 'aucune porte'}"><rect class="cc-art-base" x="5" y="5" width="90" height="90" rx="2"/><path class="cc-art-grid" d="M35 8V92 M65 8V92 M8 35H92 M8 65H92"/><g${rotatedArtwork}><path class="cc-art-corridor-shadow" d="${corridorLines}"/><path class="cc-art-corridor" d="${corridorLines}"/><path class="cc-art-walls" d="${wallLines}"/><g class="cc-art-doors">${doorMarkup}</g><rect class="cc-art-marker" x="46" y="46" width="8" height="8"/></g></svg><span class="cc-card-name">${doorLabel}</span>`
    button.addEventListener('click', () => {
      if (selectedCardId === card.id) {
        selectedCardId = null
        placementPreview = null
        setStatus('Sélection annulée.')
      } else {
        selectedCardId = card.id
        selectedCardTurns = 0
        placementPreview = null
        const placements = getPlacements(card, selectedCardTurns)
        setStatus(placements.length
          ? 'Choisissez un emplacement lumineux sur le plateau.'
          : 'Aucun emplacement compatible pour cette orientation. Faites pivoter le couloir.')
      }
      renderGameUi()
    })
    handElement.append(button)
  })

  deckCountElement.textContent = String(corridorDeck.length)
  discardCountElement.textContent = String(discardPile.length)
  actionsCountElement.textContent = String(actionsRemaining)
  if (turnLabel) turnLabel.textContent = `TOUR ${String(turnNumber).padStart(2, '0')}`
  actionsFillElement.style.width = `${(actionsRemaining / 7) * 100}%`
  const activePlayerTurn = document.querySelector<HTMLElement>('#active-player-turn')
  if (activePlayerTurn) activePlayerTurn.textContent = String(turnNumber)
  const activePlayerName = document.querySelector<HTMLElement>('.active-player-name strong')
  if (activePlayerName) activePlayerName.textContent = getSurvivorLabel(activeSurvivorKind)
  const activePlayerRole = document.querySelector<HTMLElement>('.active-player-name small')
  if (activePlayerRole) activePlayerRole.textContent = activeSurvivorKind === 'injured'
    ? 'DÉPLACEMENT · 1 COULOIR'
    : phase === 'draw' ? 'PHASE 1 · PIOCHE' : 'PHASE 2 · ACTIONS · ' + String(actionsRemaining) + ' RESTANTES'
  const phaseLabel = document.querySelector<HTMLElement>('#phase-label')
  if (phaseLabel) phaseLabel.textContent = activeSurvivorKind === 'injured'
    ? 'Déplacement du Blessé'
    : phase === 'draw' ? 'Phase 1 — Compléter la main à 3 couloirs' : 'Phase 2 — Réaliser ses actions'
  const handCount = document.querySelector<HTMLElement>('#cc-hand-count')
  if (handCount) handCount.textContent = `${hand.length} cartes`
  const selectedCard = hand.find((card) => card.id === selectedCardId)
  const hasPreview = Boolean(selectedCard && placementPreview)
  const previewIsValid = Boolean(selectedCard && placementPreview &&
    getPlacements(selectedCard, selectedCardTurns).some((candidate) => candidate.x === placementPreview?.x && candidate.z === placementPreview?.z))
  if (placeButton) placeButton.disabled = true
  if (rotateButton) rotateButton.disabled = true
  if (placementActions) placementActions.hidden = !hasPreview
  if (confirmGhostButton) confirmGhostButton.disabled = !previewIsValid
  if (rotateGhostButton) rotateGhostButton.disabled = !hasPreview
  if (cancelPlacementButton) cancelPlacementButton.disabled = true
  if (discardButton) discardButton.disabled = !pendingDraw
  if (replaceButton) replaceButton.disabled = !pendingDraw || hand.length === 0
  if (drawButton) drawButton.disabled = phase !== 'draw' || hand.length >= 3 || activeSurvivorKind === 'injured'
  if (drawButton) drawButton.textContent = phase === 'draw' ? 'Compléter ma main' : 'Pioche terminée'
  if (endTurnButton) endTurnButton.disabled = phase !== 'actions' || Boolean(pendingDraw) || Boolean(pendingRoomDraw)
  renderRoomControls()
  const resourceCounts: Record<ResourceType, string> = {
    cafe: '#resource-cafe',
    croissant: '#resource-croissant',
    citron: '#resource-citron',
    bonbon: '#resource-bonbon',
    munition: '#resource-munition',
  }
  for (const [resource, selector] of Object.entries(resourceCounts) as Array<[ResourceType, string]>) {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) element.textContent = String(resources[resource])
  }

  if (pendingDraw) {
    const note = document.createElement('p')
    note.className = 'pending-draw'
    note.textContent = `Pioche : ${corridorDefinitions[pendingDraw.kind].label}. Choisissez un couloir à remplacer, ou défaussez la carte.`
    handElement.append(note)
  }
}

unlockRoomButton?.addEventListener('click', unlockCurrentRoom)
returnRoomButton?.addEventListener('click', returnToCorridor)
drawRoomButton?.addEventListener('click', drawRoomCard)

drawButton?.addEventListener('click', refillHand)
placeButton?.addEventListener('click', confirmPlacement)
const rotateSelectedCorridor = () => {
  if (selectedCardId === null || phase !== 'actions') return
  selectedCardTurns = (selectedCardTurns + 1) % 4
  const previousPreview = placementPreview
  const card = hand.find((item) => item.id === selectedCardId)
  if (previousPreview && card) {
    const samePosition = getPlacements(card, selectedCardTurns)
      .find((candidate) => candidate.x === previousPreview.x && candidate.z === previousPreview.z)
    placementPreview = samePosition
      ? { ...samePosition, optionIndex: 0 }
      : { ...previousPreview, options: [], optionIndex: 0 }
  }
  updatePlacementHighlights()
  renderGameUi()
  setStatus(placementPreview?.options.length
    ? 'Orientation modifiée. Vérifiez les passages et validez la pose.'
    : placementPreview
      ? 'Cette orientation ne convient pas à cet emplacement. Tournez encore ou choisissez un autre emplacement.'
      : 'Orientation modifiée. Choisissez un emplacement compatible.')
}
rotateButton?.addEventListener('click', rotateSelectedCorridor)
rotateGhostButton?.addEventListener('click', rotateSelectedCorridor)
confirmGhostButton?.addEventListener('click', confirmPlacement)
cancelPlacementButton?.addEventListener('click', () => {
  selectedCardId = null
  placementPreview = null
  clearGhostTile()
  renderGameUi()
  setStatus('Pose annulée. Choisissez un couloir pour continuer.')
})
discardButton?.addEventListener('click', () => {
  if (!pendingDraw) return
  discardPile.push(pendingDraw)
  pendingDraw = null
  setStatus('Carte piochée défaussée.')
  saveGameState()
  renderGameUi()
})
replaceButton?.addEventListener('click', () => {
  if (!pendingDraw || !handElement) return
  setStatus('Choisissez dans votre main le couloir à remplacer par la pioche.')
  handElement.querySelectorAll<HTMLButtonElement>('.cc-card').forEach((button, index) => {
    button.disabled = false
    button.classList.add('is-replaceable')
    button.addEventListener('click', () => {
      const oldCard = hand[index]
      if (!oldCard || !pendingDraw) return
      discardPile.push(oldCard)
      hand[index] = pendingDraw
      pendingDraw = null
      selectedCardId = hand[index].id
      setStatus(`Couloir remplacé. « ${corridorDefinitions[oldCard.kind].label} » défaussé.`)
      saveGameState()
      renderGameUi()
    }, { once: true })
  })
})
endTurnButton?.addEventListener('click', () => {
  if (pendingDraw) {
    setStatus('Décidez d’abord du sort de la carte piochée.')
    return
  }
  if (pendingRoomDraw) {
    setStatus('Posez ou annulez la pièce piochée avant de terminer le tour.')
    return
  }
  characterIndex += 1
  if (characterIndex >= characterOrder.length) {
    characterIndex = 0
    turnNumber += 1
    injuredMovedThisTurn = false
  }
  selectedCardId = null
  placementPreview = null
  activateSurvivor(characterOrder[characterIndex])
  actionsRemaining = activeSurvivorKind === 'injured' ? 1 : 7
  phase = activeSurvivorKind === 'injured' || hand.length >= 3 ? 'actions' : 'draw'
  setStatus(activeSurvivorKind === 'injured'
    ? 'Tour du Blessé : choisissez un couloir adjacent pour le faire avancer d’une seule case.'
    : `Tour de ${getSurvivorLabel(activeSurvivorKind)} : complétez votre main à 3 couloirs avant d’agir.`)
  saveGameState()
  renderGameUi()
})

if (phase === 'draw' && activeSurvivorKind !== 'injured' && hand.length >= 3) phase = 'actions'
renderGameUi()

const resize = () => {
  const width = root.clientWidth
  const height = root.clientHeight
  if (width === 0 || height === 0) return

  const aspect = width / height
  const viewHeight = aspect < 1 ? 22 : 19
  camera.left = (-viewHeight * aspect) / 2
  camera.right = (viewHeight * aspect) / 2
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let isDragging = false
let previousPointer = { x: 0, y: 0 }
let zoom = THREE.MathUtils.clamp(savedGameState?.zoom ?? 1, 1, 3.2)
let currentZoom = zoom
const cameraTarget = new THREE.Vector3(savedGameState?.cameraTarget.x ?? 0, 0, savedGameState?.cameraTarget.z ?? 0)
const cameraDistance = Math.hypot(13, 13)
const initialCameraAngle = Math.atan2(13, 13)
let cameraAngle = savedGameState?.cameraAngle ?? initialCameraAngle
let targetCameraAngle = cameraAngle
const getCameraOffset = (angle: number) => new THREE.Vector3(
  Math.sin(angle) * cameraDistance,
  16,
  Math.cos(angle) * cameraDistance,
)
const syncCameraPosition = () => {
  camera.position.copy(cameraTarget).add(getCameraOffset(cameraAngle))
  camera.lookAt(cameraTarget)
}
syncCameraPosition()

const saveGameState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tiles: boardTiles
        .filter((tile): tile is BoardTile & { kind: CorridorKind } => tile.kind !== 'start')
        .map(({ x, z, kind, exits, doors, usedDoors }) => ({ x, z, kind, exits, doors, usedDoors })),
      rooms: rooms.map(({ id, status, difficulty, searched, unlocked, x, z, originX, originZ, direction, lastRoll }) => ({
        id, status, difficulty, searched, unlocked, x, z, originX, originZ, direction, lastRoll,
      })),
      currentRoomId,
      resources,
      roomDeck,
      pendingRoomDraw, 
      survivor: { x: currentTile.x, z: currentTile.z },
      survivors: survivorPositions,
      activeSurvivorKind,
      characterOrder,
      characterIndex,
      injuredMovedThisTurn,
      zoom,
      cameraTarget: { x: cameraTarget.x, z: cameraTarget.z },
      cameraAngle: targetCameraAngle,
      deck: corridorDeck,
      discard: discardPile,
      hand,
      survivorCards: {
        ...survivorCards,
        [activeSurvivorKind]: { deck: corridorDeck, discard: discardPile, hand },
      },
      phase,
      pendingDraw,
      actionsRemaining,
      turnNumber,
      nextCardId,
      nextRoomCardId,
    } satisfies SavedGameState))
  } catch {
    setStatus('Impossible de sauvegarder la partie dans ce navigateur.')
  }
}

let pointerDownPosition = { x: 0, y: 0 }
let hasDragged = false

renderer.domElement.addEventListener('pointerdown', (event) => {
  isDragging = true
  hasDragged = false
  pointerDownPosition = { x: event.clientX, y: event.clientY }
  previousPointer = { x: event.clientX, y: event.clientY }
  renderer.domElement.setPointerCapture(event.pointerId)
})

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isDragging) return
  const deltaX = event.clientX - previousPointer.x
  const deltaY = event.clientY - previousPointer.y
  if (Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y) > 5) {
    hasDragged = true
  }
  const worldPerPixel = (camera.top - camera.bottom) / camera.zoom / renderer.domElement.clientHeight
  camera.updateMatrixWorld()
  const screenRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  screenRight.y = 0
  screenRight.normalize()
  const screenUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  screenUp.y = 0
  screenUp.normalize()
  cameraTarget.addScaledVector(screenRight, -deltaX * worldPerPixel)
  cameraTarget.addScaledVector(screenUp, deltaY * worldPerPixel)
  syncCameraPosition()
  saveGameState()
  previousPointer = { x: event.clientX, y: event.clientY }
})

renderer.domElement.addEventListener('pointerup', () => {
  isDragging = false
})

renderer.domElement.addEventListener('pointercancel', () => {
  isDragging = false
})

renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault()
  zoom = THREE.MathUtils.clamp(zoom + event.deltaY * -0.0015, 1, 3.2)
  saveGameState()
}, { passive: false })

renderer.domElement.addEventListener('click', (event) => {
  if (hasDragged) return
  if (phase === 'draw' && activeSurvivorKind !== 'injured') {
    setStatus('Terminez d’abord la phase de pioche en complétant votre main à 3 couloirs.')
    return
  }

  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  if (pendingRoomDraw) {
    const roomPlacementHits = raycaster.intersectObjects(roomPlacementHighlights.children, true)
    const roomMarkerHit = roomPlacementHits.find((hit) => {
      let object: THREE.Object3D | null = hit.object
      while (object && object.parent !== roomPlacementHighlights) object = object.parent
      return Boolean(object?.userData.isRoomPlacementMarker)
    })
    if (roomMarkerHit) {
      let marker: THREE.Object3D | null = roomMarkerHit.object
      while (marker && marker.parent !== roomPlacementHighlights) marker = marker.parent
      const direction = marker?.userData.roomPlacementDirection as Direction | undefined
      if (direction) placeDrawnRoom(direction)
    } else {
      setStatus('Cliquez sur un emplacement lumineux pour poser la pièce.')
    }
    return
  }

  if (selectedCardId !== null && !pendingDraw) {
    const placementHits = raycaster.intersectObjects(placementHighlights.children, true)
    const markerHit = placementHits.find((hit) => {
      let object: THREE.Object3D | null = hit.object
      while (object && object.parent !== placementHighlights) object = object.parent
      return Boolean(object?.userData.isPlacementMarker)
    })
    if (markerHit) {
      let marker: THREE.Object3D | null = markerHit.object
      while (marker && marker.parent !== placementHighlights) marker = marker.parent
      if (marker) {
        const x = Number(marker.userData.placementX)
        const z = Number(marker.userData.placementZ)
        const card = hand.find((item) => item.id === selectedCardId)
        const candidate = card ? getPlacements(card).find((item) => item.x === x && item.z === z) : undefined
        if (candidate) {
          placementPreview = { x, z, options: candidate.options, optionIndex: 0 }
          updatePlacementHighlights()
          renderGameUi()
          setStatus('Couloir pré-positionné. Tournez-le si besoin, puis validez à côté de la carte.')
        }
      }
      return
    }
    setStatus('Cliquez sur un emplacement lumineux pour préparer la pose.')
    return
  }

  const roomHits = raycaster.intersectObjects(rooms.map((room) => room.group), true)
  const roomHit = roomHits[0]
  if (roomHit) {
    let roomGroup: THREE.Object3D | null = roomHit.object
    while (roomGroup && !rooms.some((room) => room.group === roomGroup)) roomGroup = roomGroup.parent
    const targetRoom = rooms.find((room) => room.group === roomGroup)
    if (targetRoom) {
      if (activeSurvivorKind === 'injured') {
        setStatus('Le Blessé ne peut pas entrer dans les pièces.')
      } else if (currentRoomId === targetRoom.id) {
        setStatus('Vous êtes déjà dans cette pièce.')
      } else if (currentRoomId !== null) {
        setStatus('Vous êtes déjà dans une pièce. Revenez dans le couloir avant d’entrer ailleurs.')
      } else if (targetRoom.originX === currentTile.x && targetRoom.originZ === currentTile.z) {
        enterRoom(targetRoom)
      } else {
        setStatus('Cette pièce n’est pas accessible depuis votre position actuelle.')
      }
    }
    return
  }

  const hits = raycaster.intersectObjects(boardTiles.map((tile) => tile.group), true)
  const hit = hits[0]
  if (!hit) {
    root.dataset.selected = 'unknown'
    return
  }

  let hitGroup: THREE.Object3D | null = hit.object
  while (hitGroup && !boardTiles.some((tile) => tile.group === hitGroup)) {
    hitGroup = hitGroup.parent
  }
  const targetTile = boardTiles.find((tile) => tile.group === hitGroup)
  if (!targetTile) return

  if (currentRoomId !== null) {
    if (targetTile === currentTile) {
      returnToCorridor()
      return
    }
    setStatus('Vous êtes dans une pièce. Revenez d’abord dans le couloir.')
    return
  }

  if (targetTile === currentTile) {
    root.dataset.selected = 'current-tile'
    setStatus('Le survivant est déjà sur cette case.')
    return
  }

  const dx = targetTile.x - currentTile.x
  const dz = targetTile.z - currentTile.z
  const direction = directionOrder.find((candidate) => {
    const [x, z] = directionDelta[candidate]
    return x === dx && z === dz
  })

  if (activeSurvivorKind === 'injured' && injuredMovedThisTurn) {
    setStatus('Le Blessé ne peut avancer que d’un seul couloir par tour.')
    return
  }

  if (!direction || Math.abs(dx) + Math.abs(dz) !== 1) {
    root.dataset.selected = 'not-adjacent'
    setStatus('Déplacement impossible : choisissez une case adjacente.')
    return
  }

  if (actionsRemaining <= 0) {
    setStatus('Il ne reste plus d’action pour se déplacer.')
    return
  }

  const canPass = currentTile.exits.includes(direction) &&
    targetTile.exits.includes(opposite[direction])
  if (!canPass) {
    root.dataset.selected = 'blocked'
    setStatus('Passage bloqué : les deux cases ne sont pas reliées par une sortie.')
    return
  }

  currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  targetTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeRing.position.set(0, 0.183, 0.16)
  currentTile = targetTile
  survivorPositions[activeSurvivorKind] = { x: currentTile.x, z: currentTile.z, roomId: null }
  if (activeSurvivorKind === 'injured') injuredMovedThisTurn = true
  spendAction()
  root.dataset.selected = 'current-tile'
  setStatus(`Déplacement effectué. ${actionsRemaining} action${actionsRemaining > 1 ? 's' : ''} restante${actionsRemaining > 1 ? 's' : ''}.`)
  saveGameState()
  renderGameUi()
})

document.querySelector<HTMLButtonElement>('#reset-game')?.addEventListener('click', () => {
  const confirmed = window.confirm('Réinitialiser la partie ? Le plateau actuel sera perdu.')
  if (!confirmed) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } finally {
    window.location.reload()
  }
})

document.querySelector<HTMLButtonElement>('#rotate-left')?.addEventListener('click', () => {
  targetCameraAngle -= Math.PI / 2
  saveGameState()
})

document.querySelector<HTMLButtonElement>('#rotate-right')?.addEventListener('click', () => {
  targetCameraAngle += Math.PI / 2
  saveGameState()
})

const clock = new THREE.Clock()
const animate = () => {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const elapsed = clock.elapsedTime
  cameraAngle = THREE.MathUtils.damp(cameraAngle, targetCameraAngle, 5, delta)
  const cameraOffset = getCameraOffset(cameraAngle)
  camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraTarget.x + cameraOffset.x, 8, delta)
  camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraTarget.y + cameraOffset.y, 8, delta)
  camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraTarget.z + cameraOffset.z, 8, delta)
  camera.lookAt(cameraTarget)
  currentZoom = THREE.MathUtils.damp(currentZoom, zoom, 4, delta)
  camera.zoom = currentZoom
  camera.updateProjectionMatrix()
  beacon.scale.y = 1 + Math.sin(elapsed * 2.2) * 0.07
  if (placementActions && !placementActions.hidden && placementPreview) {
    camera.updateMatrixWorld()
    const projected = new THREE.Vector3(placementPreview.x * 1.18, 1.1, placementPreview.z * 1.18).project(camera)
    const sceneBounds = root.parentElement?.getBoundingClientRect()
    if (sceneBounds) {
      const canvasBounds = renderer.domElement.getBoundingClientRect()
      const left = (projected.x * 0.5 + 0.5) * canvasBounds.width + canvasBounds.left - sceneBounds.left
      const top = (-projected.y * 0.5 + 0.5) * canvasBounds.height + canvasBounds.top - sceneBounds.top
      placementActions.style.left = `${left + 34}px`
      placementActions.style.top = `${top - 18}px`
    }
  }
  renderer.render(scene, camera)
}

const observer = new ResizeObserver(resize)
observer.observe(root)
resize()
animate()

window.addEventListener('beforeunload', () => {
  observer.disconnect()
  renderer.dispose()
})
