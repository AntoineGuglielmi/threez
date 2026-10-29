import * as THREE from 'three'
import './style.css'

const root = document.querySelector<HTMLDivElement>('#scene-root')

if (!root) {
  throw new Error('Scene root not found')
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('#050607')
scene.fog = new THREE.FogExp2('#050607', 0.035)

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 180)
camera.position.set(13, 16, 13)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(root.clientWidth, root.clientHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
root.appendChild(renderer.domElement)

scene.add(new THREE.AmbientLight('#b8c7d5', 0.85))
scene.add(new THREE.HemisphereLight('#dceeff', '#34363d', 0.7))

const keyLight = new THREE.DirectionalLight('#d9dce2', 2.1)
keyLight.position.set(8, 15, 7)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(2048, 2048)
keyLight.shadow.camera.left = -10
keyLight.shadow.camera.right = 10
keyLight.shadow.camera.top = 10
keyLight.shadow.camera.bottom = -10
keyLight.shadow.bias = -0.0004
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight('#9bcde0', 0.7)
fillLight.position.set(-8, 6, -5)
scene.add(fillLight)

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: '#080a0d', roughness: 1 }),
  start: new THREE.MeshStandardMaterial({ color: '#39302d', roughness: 0.9 }),
  startTop: new THREE.MeshStandardMaterial({
    color: '#747d84',
    emissive: '#172b32',
    emissiveIntensity: 0.65,
    roughness: 0.82,
  }),
  wood: new THREE.MeshStandardMaterial({ color: '#332923', roughness: 0.98 }),
  woodLight: new THREE.MeshStandardMaterial({ color: '#594438', roughness: 0.98 }),
  frame: new THREE.MeshStandardMaterial({ color: '#25272a', roughness: 0.9 }),
  corridorWall: new THREE.MeshStandardMaterial({
    color: '#35434b',
    roughness: 0.78,
    metalness: 0.28,
  }),
  corridorPanel: new THREE.MeshStandardMaterial({
    color: '#56616a',
    roughness: 0.68,
    metalness: 0.32,
  }),
  floorPanel: new THREE.MeshStandardMaterial({
    color: '#59636a',
    roughness: 0.82,
    metalness: 0.16,
  }),
  floorPanelDark: new THREE.MeshStandardMaterial({
    color: '#30383e',
    roughness: 0.9,
    metalness: 0.12,
  }),
  warning: new THREE.MeshStandardMaterial({
    color: '#e0a45d',
    emissive: '#9b4e18',
    emissiveIntensity: 0.8,
    roughness: 0.5,
  }),
  tileNeon: new THREE.MeshStandardMaterial({
    color: '#e0faff',
    emissive: '#59c9f3',
    emissiveIntensity: 3.8,
    roughness: 0.22,
    metalness: 0.05,
  }),
}

// The ground has no visible edge: the world simply disappears into the fog.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), materials.floor)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.18
floor.receiveShadow = true
scene.add(floor)

// A broad placement grid fades into darkness instead of ending at a board border.
const gridSize = 120
const grid = new THREE.GridHelper(gridSize, gridSize, '#343940', '#24282e')
grid.position.y = -0.012
const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
gridMaterials.forEach((material) => {
  const lineMaterial = material as THREE.LineBasicMaterial
  lineMaterial.transparent = true
  lineMaterial.opacity = 0.42
  lineMaterial.depthWrite = false
})
scene.add(grid)

// A single starting tile floats visually in a large, unexplored space.
const board = new THREE.Group()
scene.add(board)

const start = new THREE.Group()
start.position.set(0, 0.025, 0)
board.add(start)

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.2, 48),
  new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.55, depthWrite: false }),
)
shadow.rotation.x = -Math.PI / 2
shadow.position.y = -0.005
shadow.scale.set(1.2, 0.82, 1)
start.add(shadow)

const slab = new THREE.Mesh(
  new THREE.BoxGeometry(1.18, 0.14, 1.18),
  materials.start,
)
slab.position.y = 0.07
slab.castShadow = true
slab.receiveShadow = true
start.add(slab)

const top = new THREE.Mesh(
  new THREE.BoxGeometry(1.08, 0.025, 1.08),
  materials.startTop,
)
top.position.y = 0.152
top.receiveShadow = true
start.add(top)

// The starting room reads as a short hospital corridor, with modular floor panels.
for (let x = -1; x <= 1; x += 1) {
  for (let z = -1; z <= 1; z += 1) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.009, 0.32),
      (x + z) % 2 === 0 ? materials.floorPanel : materials.floorPanelDark,
    )
    panel.position.set(x * 0.34, 0.169, z * 0.34)
    panel.receiveShadow = true
    start.add(panel)
  }
}

// Low industrial walls frame the passage without hiding the floor or entrance.
for (const side of [-1, 1]) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.29, 0.78),
    materials.corridorWall,
  )
  wall.position.set(side * 0.49, 0.31, 0.045)
  wall.castShadow = true
  wall.receiveShadow = true
  start.add(wall)

  for (const z of [-0.2, 0.16, 0.42]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.13, 0.19),
      materials.corridorPanel,
    )
    panel.position.set(side * 0.455, 0.32, z)
    start.add(panel)
  }

  const safetyStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.025, 0.76),
    materials.warning,
  )
  safetyStripe.position.set(side * 0.452, 0.205, 0.045)
  start.add(safetyStripe)
}

// Small amber floor markers add a little warmth against the cold neon.
for (const z of [-0.22, 0.22]) {
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.012, 0.045),
    materials.warning,
  )
  marker.position.set(0, 0.18, z)
  start.add(marker)
}

// Cool neon strips trace the tile edges, like floor lighting in an abandoned facility.
const neon = new THREE.Group()
neon.position.y = 0.168
start.add(neon)

const neonLength = 0.92
const neonWidth = 0.032
const neonOffset = 0.49
for (const side of [-1, 1]) {
  const stripX = new THREE.Mesh(
    new THREE.BoxGeometry(neonWidth, 0.012, neonLength),
    materials.tileNeon,
  )
  stripX.position.set(side * neonOffset, 0, 0)
  neon.add(stripX)

  const stripZ = new THREE.Mesh(
    new THREE.BoxGeometry(neonLength, 0.012, neonWidth),
    materials.tileNeon,
  )
  stripZ.position.set(0, 0, side * neonOffset)
  neon.add(stripZ)
}

// The neon strips cast a strong, cool pool of light across the tile itself.
const tileLight = new THREE.PointLight('#75d9ff', 4.2, 5.2, 1.5)
tileLight.position.set(0, 0.48, 0)
start.add(tileLight)

// Additional low lights keep the corners bright instead of leaving only a lit outline.
for (const x of [-0.38, 0.38]) {
  for (const z of [-0.38, 0.38]) {
    const cornerLight = new THREE.PointLight('#64c9f4', 1.15, 2.2, 1.8)
    cornerLight.position.set(x, 0.24, z)
    start.add(cornerLight)
  }
}

// Survivors are simple low-poly figures built from primitives, so they stay editable in code.
const characterMaterials = {
  hood: new THREE.MeshStandardMaterial({ color: '#17232b', roughness: 0.92 }),
  stealthCloth: new THREE.MeshStandardMaterial({ color: '#263d49', roughness: 0.86 }),
  skin: new THREE.MeshStandardMaterial({ color: '#b77f64', roughness: 0.92 }),
  skinShadow: new THREE.MeshStandardMaterial({ color: '#523d37', roughness: 0.98 }),
  heavyCloth: new THREE.MeshStandardMaterial({ color: '#665447', roughness: 0.95 }),
  heavyVest: new THREE.MeshStandardMaterial({ color: '#34383a', roughness: 0.95 }),
  military: new THREE.MeshStandardMaterial({ color: '#46543b', roughness: 0.94 }),
  militaryDark: new THREE.MeshStandardMaterial({ color: '#303a2c', roughness: 0.98 }),
  beret: new THREE.MeshStandardMaterial({ color: '#743c3e', roughness: 0.9 }),
  labCoat: new THREE.MeshStandardMaterial({ color: '#d5d8d6', roughness: 0.92 }),
  labShadow: new THREE.MeshStandardMaterial({ color: '#7f9399', roughness: 0.85 }),
  shirt: new THREE.MeshStandardMaterial({ color: '#4d4641', roughness: 0.95 }),
  trousers: new THREE.MeshStandardMaterial({ color: '#34373b', roughness: 0.98 }),
  boot: new THREE.MeshStandardMaterial({ color: '#17191b', roughness: 0.95 }),
  glasses: new THREE.MeshStandardMaterial({ color: '#202a31', metalness: 0.65, roughness: 0.3 }),
  lens: new THREE.MeshStandardMaterial({ color: '#8ec7d8', metalness: 0.25, roughness: 0.2 }),
  activeRing: new THREE.MeshBasicMaterial({ color: '#75d9ff' }),
}

const makePart = (
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

const createCharacter = (kind: 'stealth' | 'heavy' | 'military' | 'scientist' | 'injured') => {
  const character = new THREE.Group()
  const torsoMaterials = {
    stealth: characterMaterials.stealthCloth,
    heavy: characterMaterials.heavyCloth,
    military: characterMaterials.military,
    scientist: characterMaterials.labCoat,
    injured: characterMaterials.shirt,
  }
  const torsoMaterial = torsoMaterials[kind]
  const torsoWidth = kind === 'heavy' ? 0.28 : kind === 'scientist' ? 0.19 : 0.21
  const torsoHeight = kind === 'injured' ? 0.27 : 0.31
  const lean = kind === 'injured' ? -0.22 : 0

  // Legs and boots. The injured survivor's uneven stance hints at his limp.
  for (const side of [-1, 1]) {
    const legX = side * (kind === 'heavy' ? 0.085 : 0.06)
    const legRotation = kind === 'injured' && side === 1 ? -0.22 : 0
    makePart(
      character,
      new THREE.BoxGeometry(kind === 'heavy' ? 0.09 : 0.065, 0.2, 0.075),
      kind === 'military' ? characterMaterials.militaryDark : characterMaterials.trousers,
      [legX, 0.115, side === 1 && kind === 'injured' ? 0.055 : 0],
      [legRotation, 0, 0],
    )
    makePart(
      character,
      new THREE.BoxGeometry(0.085, 0.055, 0.13),
      characterMaterials.boot,
      [legX, 0.035, 0.025],
      [0, 0, kind === 'injured' && side === 1 ? -0.18 : 0],
    )
  }

  // Torso, shoulders and arms.
  makePart(
    character,
    new THREE.BoxGeometry(torsoWidth, torsoHeight, 0.13),
    torsoMaterial,
    [0, 0.34, 0],
    [0, 0, lean],
  )

  if (kind === 'heavy') {
    makePart(character, new THREE.BoxGeometry(0.39, 0.13, 0.16), characterMaterials.heavyVest, [0, 0.47, 0])
    makePart(character, new THREE.BoxGeometry(0.22, 0.2, 0.145), characterMaterials.heavyVest, [0, 0.34, 0.075])
  } else if (kind === 'military') {
    makePart(character, new THREE.BoxGeometry(0.24, 0.11, 0.15), characterMaterials.militaryDark, [0, 0.39, 0.075])
    for (const side of [-1, 1]) {
      makePart(character, new THREE.BoxGeometry(0.065, 0.075, 0.035), characterMaterials.heavyCloth, [side * 0.105, 0.33, 0.09])
    }
  } else if (kind === 'scientist') {
    // Open lab coat panels and a dark shirt give the silhouette a clear white coat.
    makePart(character, new THREE.BoxGeometry(0.075, 0.28, 0.035), characterMaterials.labShadow, [-0.055, 0.34, 0.078])
    makePart(character, new THREE.BoxGeometry(0.075, 0.28, 0.035), characterMaterials.labShadow, [0.055, 0.34, 0.078])
  } else if (kind === 'injured') {
    makePart(character, new THREE.BoxGeometry(0.07, 0.1, 0.035), characterMaterials.skinShadow, [0.07, 0.39, 0.08])
  }

  for (const side of [-1, 1]) {
    const shoulderX = side * (kind === 'heavy' ? 0.19 : kind === 'scientist' ? 0.13 : 0.14)
    makePart(
      character,
      new THREE.BoxGeometry(kind === 'heavy' ? 0.11 : 0.075, 0.22, 0.085),
      kind === 'scientist' ? characterMaterials.labCoat : torsoMaterial,
      [shoulderX, 0.34, 0],
      [0, 0, side * (kind === 'injured' ? 0.2 : 0.08)],
    )
  }

  // Head and face.
  const headY = kind === 'heavy' ? 0.59 : 0.585
  makePart(
    character,
    new THREE.SphereGeometry(kind === 'heavy' ? 0.105 : 0.09, 10, 8),
    kind === 'stealth' ? characterMaterials.hood : characterMaterials.skin,
    [0, headY, 0.015],
  )

  if (kind === 'stealth') {
    makePart(character, new THREE.ConeGeometry(0.145, 0.25, 7), characterMaterials.hood, [0, 0.64, -0.015])
    makePart(character, new THREE.BoxGeometry(0.105, 0.045, 0.075), characterMaterials.skinShadow, [0, 0.555, 0.083])
  } else {
    // Simple facial planes and eyes keep each silhouette readable at small scale.
    makePart(character, new THREE.BoxGeometry(0.052, 0.018, 0.012), characterMaterials.skinShadow, [-0.03, headY + 0.005, 0.095])
    makePart(character, new THREE.BoxGeometry(0.052, 0.018, 0.012), characterMaterials.skinShadow, [0.03, headY + 0.005, 0.095])
  }

  if (kind === 'military') {
    makePart(character, new THREE.SphereGeometry(0.105, 10, 6), characterMaterials.beret, [0, 0.665, 0.005], [0, 0, -0.1])
    makePart(character, new THREE.BoxGeometry(0.12, 0.025, 0.08), characterMaterials.beret, [0, 0.635, 0.02])
  }

  if (kind === 'scientist') {
    // Bald scalp, unmistakable glasses and a white coat.
    makePart(character, new THREE.SphereGeometry(0.092, 10, 8), characterMaterials.skin, [0, 0.61, 0.015])
    for (const side of [-1, 1]) {
      makePart(character, new THREE.BoxGeometry(0.06, 0.045, 0.018), characterMaterials.glasses, [side * 0.033, 0.615, 0.099])
      makePart(character, new THREE.BoxGeometry(0.043, 0.028, 0.008), characterMaterials.lens, [side * 0.033, 0.615, 0.11])
    }
    makePart(character, new THREE.BoxGeometry(0.025, 0.012, 0.015), characterMaterials.glasses, [0, 0.615, 0.104])
  }

  if (kind === 'injured') {
    // A crooked walking stick makes the limp legible even when the figure is tiny.
    makePart(character, new THREE.CylinderGeometry(0.009, 0.009, 0.34, 5), materials.woodLight, [0.18, 0.19, 0.035], [0, 0, -0.12])
    makePart(character, new THREE.BoxGeometry(0.07, 0.025, 0.025), materials.woodLight, [0.18, 0.35, 0.035])
    makePart(character, new THREE.BoxGeometry(0.1, 0.04, 0.07), characterMaterials.skinShadow, [0, 0.47, 0.04], [0, 0, -0.15])
  }

  // Tiny colour accents help the roles read clearly in the isometric view.
  if (kind === 'stealth') {
    makePart(character, new THREE.BoxGeometry(0.045, 0.13, 0.045), characterMaterials.heavyVest, [0.105, 0.34, -0.015], [0, 0, -0.1])
  }

  return character
}

// The stealth character takes the first turn and is shown at full size.
// Other survivors remain visible as small tokens around the same starting tile.
const activeSurvivorKind = 'stealth' as const
const activeCharacter = createCharacter(activeSurvivorKind)
activeCharacter.position.set(0, 0.19, 0.16)
activeCharacter.scale.setScalar(0.72)
start.add(activeCharacter)

// Character-focused lighting keeps faces, silhouettes and outfit colours readable
// without lifting the darkness of the unexplored surroundings.
const characterKeyLight = new THREE.PointLight('#d8f4ff', 3.8, 4.5, 1.6)
characterKeyLight.position.set(0.05, 1.5, 0.35)
start.add(characterKeyLight)

const characterFillLight = new THREE.PointLight('#5ebfe8', 2.2, 3.4, 1.8)
characterFillLight.position.set(-0.65, 0.75, 0.15)
start.add(characterFillLight)

const warmRimLight = new THREE.PointLight('#f0b17a', 1.4, 2.8, 1.8)
warmRimLight.position.set(0.55, 0.65, -0.45)
start.add(warmRimLight)

const activeRing = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.235, 32),
  characterMaterials.activeRing,
)
activeRing.rotation.x = -Math.PI / 2
activeRing.position.set(0, 0.183, 0.16)
start.add(activeRing)


const otherCharacters: Array<{ kind: 'heavy' | 'military' | 'scientist' | 'injured'; character: THREE.Group; position: [number, number, number] }> = [
  { kind: 'heavy', character: createCharacter('heavy'), position: [-0.32, 0.19, -0.28] },
  { kind: 'military', character: createCharacter('military'), position: [0.32, 0.19, -0.28] },
  { kind: 'scientist', character: createCharacter('scientist'), position: [-0.32, 0.19, 0.36] },
  { kind: 'injured', character: createCharacter('injured'), position: [0.32, 0.19, 0.36] },
]

for (const { character, position } of otherCharacters) {
  character.position.set(...position)
  character.scale.setScalar(0.27)
  start.add(character)
}

// Barricaded hospital entrance.
const framePosts = [-0.34, 0.34]
for (const x of framePosts) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.57, 0.075), materials.frame)
  post.position.set(x, 0.44, -0.34)
  post.castShadow = true
  start.add(post)
}

const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.075), materials.frame)
lintel.position.set(0, 0.72, -0.34)
lintel.castShadow = true
start.add(lintel)

const door = new THREE.Mesh(
  new THREE.BoxGeometry(0.53, 0.43, 0.055),
  new THREE.MeshStandardMaterial({ color: '#211d1b', roughness: 0.98 }),
)
door.position.set(0, 0.38, -0.3)
door.castShadow = true
start.add(door)

for (const [index, rotation] of [0.28, -0.28].entries()) {
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.075, 0.09),
    index === 0 ? materials.woodLight : materials.wood,
  )
  plank.position.set(0, 0.39 + index * 0.1, -0.24)
  plank.rotation.z = rotation
  plank.castShadow = true
  start.add(plank)
}

// One small amber marker is the only saturated colour in the scene.
const beacon = new THREE.Mesh(
  new THREE.BoxGeometry(0.11, 0.11, 0.11),
  new THREE.MeshBasicMaterial({ color: '#bd7958' }),
)
beacon.position.set(0.38, 0.24, 0.36)
start.add(beacon)

const beaconLight = new THREE.PointLight('#a86649', 0.5, 2.5)
beaconLight.position.set(0.38, 0.48, 0.36)
start.add(beaconLight)


type CorridorKind = 'straight' | 'left' | 'right' | 'tee' | 'cross'
type Direction = 'N' | 'E' | 'S' | 'W'
type CorridorCard = { id: number; kind: CorridorKind; doors: Direction[] }
type RoomStatus = 'ordinary' | 'locked' | 'trapped'
type RoomDifficulty = 'easy' | 'medium' | 'hard'
type ResourceType = 'cafe' | 'croissant' | 'citron' | 'bonbon' | 'munition'
type RoomCard = { id: number; status: RoomStatus; difficulty: RoomDifficulty; searched: boolean; unlocked: boolean }
type SavedRoom = RoomCard & { x: number; z: number; originX: number; originZ: number; direction: Direction }
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
  nextRoomCardId?: number
  survivor: { x: number; z: number }
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

let nextCardId = 1
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

// Virtual CC pile: 40 cards, with eight copies of each topology.
const generatedCorridorDeck = shuffle(
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
const corridorDeck: CorridorCard[] = savedGameState ? savedGameState.deck.map(normalizeSavedCard) : generatedCorridorDeck
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
const discardPile: CorridorCard[] = savedGameState ? savedGameState.discard.map(normalizeSavedCard) : []
let hand: CorridorCard[] = savedGameState ? savedGameState.hand.map(normalizeSavedCard) : []
let pendingDraw: CorridorCard | null = savedGameState?.pendingDraw ? normalizeSavedCard(savedGameState.pendingDraw) : null
let selectedCardId: number | null = null
let actionsRemaining = savedGameState?.actionsRemaining ?? 7
let turnNumber = savedGameState?.turnNumber ?? 1
if (savedGameState) nextCardId = savedGameState.nextCardId
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
let placementPreview: { x: number; z: number; options: PlacementOption[]; optionIndex: number } | null = null
const placementHighlights = new THREE.Group()
placementHighlights.name = 'placement-highlights'
board.add(placementHighlights)

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
      if (boardTiles.some((placed) => placed.x === x && placed.z === z)) continue
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

const createCorridorTile = (card: CorridorCard, x: number, z: number, exits: Direction[], doors: Direction[] = []) => {
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
  room.searched = true
  room.group.remove(...room.group.children.filter((child) => child instanceof THREE.PointLight))
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
    if (deckIndex < 0) throw new Error('Not enough straight CC cards for setup')
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
    const group = createCorridorTile(card, tile.x, tile.z, tile.exits, doors)
    boardTiles.push({ ...tile, exits: [...tile.exits], doors: [...doors], usedDoors: [...(tile.usedDoors ?? [])], group })
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

if (savedGameState?.survivor) {
  const restoredTile = boardTiles.find(
    (tile) => tile.x === savedGameState.survivor.x && tile.z === savedGameState.survivor.z,
  )
  if (restoredTile) {
    currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
    restoredTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
    activeCharacter.position.set(0, 0.19, 0.16)
    activeRing.position.set(0, 0.183, 0.16)
    currentTile = restoredTile
  }
}
if (currentRoomId !== null) {
  const restoredRoom = rooms.find((room) => room.id === currentRoomId)
  if (restoredRoom) {
    currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
    restoredRoom.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
    activeCharacter.position.set(0, 0.19, 0)
    activeRing.position.set(0, 0.183, 0)
  } else {
    currentRoomId = null
  }
}
if (savedGameState) nextCardId = savedGameState.nextCardId

const getPlacements = (card: CorridorCard): PlacementCandidate[] => {
  const candidates = new Map<string, PlacementCandidate>()
  const definition = corridorDefinitions[card.kind]

  for (const tile of boardTiles) {
    for (const exit of tile.exits) {
      const [dx, dz] = directionDelta[exit]
      const x = tile.x + dx
      const z = tile.z + dz
      if (boardTiles.some((placed) => placed.x === x && placed.z === z)) continue

      const key = `${x},${z}`
      const candidate = candidates.get(key) ?? { x, z, options: [] }

      for (let turns = 0; turns < 4; turns += 1) {
        const exits = definition.exits.map((direction) => rotateDirection(direction, turns))
        if (!exits.includes(opposite[exit])) continue

        const conflictsWithNeighbour = directionOrder.some((direction) => {
          const [nextX, nextZ] = directionDelta[direction]
          const neighbour = boardTiles.find((placed) => placed.x === x + nextX && placed.z === z + nextZ)
          if (!neighbour) return false
          return exits.includes(direction) !== neighbour.exits.includes(opposite[direction])
        })
        if (conflictsWithNeighbour) continue

        const signature = directionOrder.filter((direction) => exits.includes(direction)).join('')
        if (!candidate.options.some((option) => directionOrder.filter((direction) => option.exits.includes(direction)).join('') === signature)) {
          candidate.options.push({ exits, turns })
        }
      }

      if (candidate.options.length > 0) candidates.set(key, candidate)
    }
  }

  return [...candidates.values()]
}

const updatePlacementHighlights = () => {
  for (const child of placementHighlights.children) {
    child.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
      meshMaterials.forEach((material) => material.dispose())
    })
  }
  placementHighlights.clear()
  if (selectedCardId === null || actionsRemaining <= 0 || pendingDraw) return
  const card = hand.find((item) => item.id === selectedCardId)
  if (!card) return

  const candidates = getPlacements(card)
  for (const candidate of candidates) {
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
    pad.userData.isPlacementHitArea = true
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
    marker.add(ring)

    if (isSelected && placementPreview) {
      const option = placementPreview.options[placementPreview.optionIndex]
      for (const direction of option.exits) {
        const [dx, dz] = directionDelta[direction]
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(dx === 0 ? 0.42 : 0.055, 0.012, dz === 0 ? 0.42 : 0.055),
          new THREE.MeshBasicMaterial({ color: '#bcefff' }),
        )
        bar.position.set(dx * 0.23, 0.008, dz * 0.23)
        marker.add(bar)
      }
    }

    placementHighlights.add(marker)
  }
}

const spendAction = () => {
  actionsRemaining = Math.max(0, actionsRemaining - 1)
  if (actionsRemaining === 0) setStatus('Plus d’actions. Terminez le tour pour continuer.')
}

const confirmPlacement = () => {
  const card = hand.find((item) => item.id === selectedCardId)
  if (!card || !placementPreview || actionsRemaining <= 0) return
  const option = placementPreview.options[placementPreview.optionIndex]
  const { x, z } = placementPreview
  if (boardTiles.some((tile) => tile.x === x && tile.z === z)) {
    placementPreview = null
    updatePlacementHighlights()
    setStatus('Cet emplacement n’est plus disponible. Choisissez-en un autre.')
    return
  }

  const doors = card.doors.map((direction) => rotateDirection(direction, option.turns))
  const group = createCorridorTile(card, x, z, option.exits, doors)
  const placedTile: BoardTile = { x, z, kind: card.kind, exits: option.exits, doors, group }
  boardTiles.push(placedTile)

  // Placing a corridor also moves the active survivor onto it for the same action.
  currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  placedTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeRing.position.set(0, 0.183, 0.16)
  currentTile = placedTile

  hand = hand.filter((item) => item.id !== card.id)
  spendAction()
  selectedCardId = null
  placementPreview = null
  setStatus(`CC « ${corridorDefinitions[card.kind].label} » posée : le survivant s’y déplace. ${actionsRemaining} action${actionsRemaining > 1 ? 's' : ''} restante${actionsRemaining > 1 ? 's' : ''}.`)
  saveGameState()
  renderGameUi()
}

const drawCorridorCard = () => {
  if (actionsRemaining <= 0 || pendingDraw) return
  if (corridorDeck.length === 0) corridorDeck.push(...shuffle(discardPile.splice(0, discardPile.length)))
  const card = corridorDeck.pop()
  if (!card) {
    setStatus('La pioche CC est vide.')
    return
  }
  spendAction()
  const placement = findPlacement(card)
  if (placement) {
    const doors = card.doors.map((direction) => rotateDirection(direction, placement.turns))
    const group = createCorridorTile(card, placement.x, placement.z, placement.exits, doors)
    boardTiles.push({ x: placement.x, z: placement.z, kind: card.kind, exits: placement.exits, doors, usedDoors: [], group })
    pendingDraw = null
    setStatus(`CC piochée et posée : ${corridorDefinitions[card.kind].label.toLowerCase()}.`)
  } else {
    pendingDraw = card
    setStatus('Impossible de poser cette CC. Défaussez-la ou échangez-la avec une carte en main.')
  }
  saveGameState()
  renderGameUi()
}


const roomDoorOptionsElement = document.querySelector<HTMLDivElement>('#cp-door-options')
const roomDeckCountElement = document.querySelector<HTMLElement>('#cp-deck-count')
const roomStateElement = document.querySelector<HTMLElement>('#room-state')
const unlockRoomButton = document.querySelector<HTMLButtonElement>('#unlock-room')
const returnRoomButton = document.querySelector<HTMLButtonElement>('#return-room')

const exploreDoor = (direction: Direction) => {
  if (actionsRemaining <= 0 || currentRoomId !== null) return
  if (!currentTile.doors.includes(direction) || currentTile.usedDoors.includes(direction)) return
  const [dx, dz] = directionDelta[direction]
  const x = currentTile.x + dx
  const z = currentTile.z + dz
  if (boardTiles.some((tile) => tile.x === x && tile.z === z) || rooms.some((room) => room.x === x && room.z === z)) {
    setStatus('Impossible de placer une pièce de ce côté : l’emplacement est occupé.')
    return
  }
  const card = roomDeck.pop()
  if (!card) {
    setStatus('La pioche CP est vide.')
    renderGameUi()
    return
  }
  const room: SavedRoom = { ...card, x, z, originX: currentTile.x, originZ: currentTile.z, direction }
  const group = createRoomTile(room, opposite[direction])
  const roomTile: RoomTile = { ...room, group }
  rooms.push(roomTile)
  currentTile.usedDoors.push(direction)
  currentRoomId = room.id
  currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0)
  activeRing.position.set(0, 0.183, 0)
  spendAction()
  selectedCardId = null
  placementPreview = null
  if (room.status === 'locked') {
    setStatus('Pièce verrouillée. Déverrouillez-la pour pouvoir la fouiller.')
    saveGameState()
    renderGameUi()
    return
  }
  if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Pièce piégée : seul le survivant furtif peut la fouiller.')
    saveGameState()
    renderGameUi()
    return
  }
  setStatus(`Pièce ${getRoomStatusLabel(room.status).toLowerCase()} découverte. Fouille en cours…`)
  rollRoomDice(roomTile)
}

const unlockCurrentRoom = () => {
  if (currentRoomId === null || actionsRemaining <= 0) return
  const room = rooms.find((item) => item.id === currentRoomId)
  if (!room || room.status !== 'locked' || room.unlocked) return
  room.unlocked = true
  spendAction()
  setStatus('Porte déverrouillée. Fouille en cours…')
  rollRoomDice(room)
}

const returnToCorridor = () => {
  if (currentRoomId === null || actionsRemaining <= 0) return
  currentTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeRing.position.set(0, 0.183, 0.16)
  currentRoomId = null
  spendAction()
  setStatus('Retour dans le couloir.')
  saveGameState()
  renderGameUi()
}

const renderRoomControls = () => {
  if (roomDeckCountElement) roomDeckCountElement.textContent = String(roomDeck.length)
  if (!roomDoorOptionsElement || !roomStateElement) return
  roomDoorOptionsElement.replaceChildren()
  const currentRoom = currentRoomId === null ? null : rooms.find((room) => room.id === currentRoomId) ?? null
  if (currentRoom) {
    roomStateElement.textContent = `CP ${String(currentRoom.id).padStart(2, '0')} · ${getRoomStatusLabel(currentRoom.status)} · ${getDifficultyLabel(currentRoom.difficulty)}${currentRoom.searched ? ' · Fouillée' : ''}`
    if (unlockRoomButton) {
      unlockRoomButton.hidden = currentRoom.status !== 'locked' || currentRoom.unlocked
      unlockRoomButton.disabled = actionsRemaining <= 0
    }
    if (returnRoomButton) {
      returnRoomButton.hidden = false
      returnRoomButton.disabled = actionsRemaining <= 0
    }
    roomDoorOptionsElement.textContent = currentRoom.status === 'locked' && !currentRoom.unlocked
      ? 'La porte est verrouillée.'
      : currentRoom.searched ? 'Cette pièce a déjà été fouillée.' : 'La pièce attend d’être fouillée.'
    return
  }
  if (unlockRoomButton) unlockRoomButton.hidden = true
  if (returnRoomButton) returnRoomButton.hidden = true
  roomStateElement.textContent = 'Vous êtes dans le couloir.'
  const availableDoors = currentTile.doors.filter((direction) => {
    if (currentTile.usedDoors.includes(direction)) return false
    const [dx, dz] = directionDelta[direction]
    const x = currentTile.x + dx
    const z = currentTile.z + dz
    return !boardTiles.some((tile) => tile.x === x && tile.z === z) &&
      !rooms.some((room) => room.x === x && room.z === z)
  })
  if (availableDoors.length === 0) {
    roomDoorOptionsElement.textContent = currentTile.doors.length
      ? 'Aucune porte inutilisée accessible sur cette CC.'
      : 'Cette CC ne possède aucune porte.'
    return
  }
  availableDoors.forEach((direction) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'action-button primary'
    button.disabled = actionsRemaining <= 0
    button.textContent = `Explorer la porte ${direction} · 1 action`
    button.addEventListener('click', () => exploreDoor(direction))
    roomDoorOptionsElement.append(button)
  })
}

const renderGameUi = () => {
  updatePlacementHighlights()
  if (!handElement || !deckCountElement || !discardCountElement || !actionsCountElement || !actionsFillElement) return
  handElement.replaceChildren()
  hand.forEach((card, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `cc-card${selectedCardId === card.id ? ' is-selected' : ''}`
    button.disabled = actionsRemaining <= 0 || Boolean(pendingDraw)
    button.setAttribute('aria-pressed', String(selectedCardId === card.id))
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
    button.innerHTML = `<span class="cc-card-index">CC ${String(index + 1).padStart(2, '0')}</span><svg class="cc-card-art" viewBox="0 0 100 100" role="img" aria-label="${corridorDefinitions[card.kind].label}, ${card.doors.length} porte${card.doors.length === 1 ? '' : 's'}"><rect class="cc-art-base" x="5" y="5" width="90" height="90" rx="2"/><path class="cc-art-grid" d="M35 8V92 M65 8V92 M8 35H92 M8 65H92"/><path class="cc-art-corridor-shadow" d="${corridorLines}"/><path class="cc-art-corridor" d="${corridorLines}"/><path class="cc-art-walls" d="${wallLines}"/><g class="cc-art-doors">${doorMarkup}</g><rect class="cc-art-marker" x="46" y="46" width="8" height="8"/></svg><span class="cc-card-name">${corridorDefinitions[card.kind].label} · ${card.doors.length}P</span>`
    button.addEventListener('click', () => {
      if (selectedCardId === card.id) {
        selectedCardId = null
        placementPreview = null
        setStatus('Sélection annulée.')
      } else {
        selectedCardId = card.id
        placementPreview = null
        const placements = getPlacements(card)
        setStatus(placements.length
          ? 'Choisissez un emplacement lumineux sur le plateau.'
          : 'Aucun emplacement compatible pour cette CC.')
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
  const handCount = document.querySelector<HTMLElement>('.hand-heading > span')
  if (handCount) handCount.textContent = `${hand.length} CC`
  const selectedCard = hand.find((card) => card.id === selectedCardId)
  const hasPreview = Boolean(selectedCard && placementPreview)
  if (placeButton) {
    placeButton.disabled = !hasPreview || actionsRemaining <= 0 || Boolean(pendingDraw)
    placeButton.textContent = hasPreview ? 'Valider la pose' : 'Choisir un emplacement'
  }
  if (rotateButton) {
    rotateButton.disabled = !hasPreview || (placementPreview?.options.length ?? 0) < 2
    rotateButton.textContent = hasPreview && placementPreview
      ? `Orientation ${placementPreview.optionIndex + 1}/${placementPreview.options.length} · ↻`
      : 'Changer l’orientation'
  }
  if (cancelPlacementButton) cancelPlacementButton.disabled = selectedCardId === null
  if (discardButton) discardButton.disabled = !pendingDraw
  if (replaceButton) replaceButton.disabled = !pendingDraw || hand.length === 0
  if (drawButton) drawButton.disabled = actionsRemaining <= 0 || Boolean(pendingDraw) || (corridorDeck.length === 0 && discardPile.length === 0)
  if (endTurnButton) endTurnButton.disabled = Boolean(pendingDraw)
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
    note.textContent = `Pioche : ${corridorDefinitions[pendingDraw.kind].label}. Choisissez une CC à remplacer, ou défaussez la pioche.`
    handElement.append(note)
  }
}

unlockRoomButton?.addEventListener('click', unlockCurrentRoom)
returnRoomButton?.addEventListener('click', returnToCorridor)

drawButton?.addEventListener('click', drawCorridorCard)
placeButton?.addEventListener('click', () => {
  if (!placementPreview) {
    setStatus('Sélectionnez d’abord un emplacement lumineux sur le plateau.')
    return
  }
  confirmPlacement()
})
rotateButton?.addEventListener('click', () => {
  if (!placementPreview || placementPreview.options.length < 2) return
  placementPreview.optionIndex = (placementPreview.optionIndex + 1) % placementPreview.options.length
  updatePlacementHighlights()
  renderGameUi()
  setStatus(`Orientation ${placementPreview.optionIndex + 1}/${placementPreview.options.length}. Vous pouvez encore changer de case.`)
})
cancelPlacementButton?.addEventListener('click', () => {
  selectedCardId = null
  placementPreview = null
  renderGameUi()
  setStatus('Pose annulée. Choisissez une CC pour continuer.')
})
discardButton?.addEventListener('click', () => {
  if (!pendingDraw) return
  discardPile.push(pendingDraw)
  pendingDraw = null
  setStatus('CC piochée défaussée.')
  saveGameState()
  renderGameUi()
})
replaceButton?.addEventListener('click', () => {
  if (!pendingDraw || !handElement) return
  setStatus('Choisissez dans votre main la CC à remplacer par la pioche.')
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
      setStatus(`CC remplacée. « ${corridorDefinitions[oldCard.kind].label} » défaussée.`)
      saveGameState()
      renderGameUi()
    }, { once: true })
  })
})
endTurnButton?.addEventListener('click', () => {
  if (pendingDraw) {
    setStatus('Décidez d’abord du sort de la CC piochée.')
    return
  }
  turnNumber += 1
  actionsRemaining = 7
  while (hand.length < 3 && corridorDeck.length > 0) hand.push(corridorDeck.pop()!)
  selectedCardId = null
  placementPreview = null
  setStatus('Nouveau tour : 7 actions. Votre main est prête.')
  saveGameState()
  renderGameUi()
})

while (hand.length < 3 && corridorDeck.length > 0) hand.push(corridorDeck.pop()!)
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
      rooms: rooms.map(({ group: _group, ...room }) => room),
      currentRoomId,
      resources,
      roomDeck, 
      survivor: { x: currentTile.x, z: currentTile.z },
      zoom,
      cameraTarget: { x: cameraTarget.x, z: cameraTarget.z },
      cameraAngle: targetCameraAngle,
      deck: corridorDeck,
      discard: discardPile,
      hand,
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

  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  if (selectedCardId !== null && !pendingDraw && actionsRemaining > 0) {
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
          setStatus('Emplacement choisi. Changez l’orientation si besoin, puis validez la pose.')
        }
      }
      return
    }
    setStatus('Cliquez sur un emplacement lumineux pour préparer la pose.')
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
