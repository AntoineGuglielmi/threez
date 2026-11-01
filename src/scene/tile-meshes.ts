import * as THREE from 'three'
import { createCorridorCardTexture } from './corridor-card-texture'
import type { CorridorCard, Direction, SavedRoom } from '../game/types'
import type { createScene } from '../scene'

type SceneMaterials = ReturnType<typeof createScene>['materials']
type CorridorMaterials = Pick<SceneMaterials, 'start' | 'startTop' | 'floorPanel' | 'floorPanelDark' | 'corridorWall' | 'tileNeon'>

export const createCorridorTile = (
  board: THREE.Group,
  _materials: CorridorMaterials,
  card: CorridorCard,
  x: number,
  z: number,
  exits: Direction[],
  doors: Direction[] = [],
  _usedDoors: Direction[] = [],
) => {
  const group = new THREE.Group()
  group.position.set(x * 1.18, 0.025, z * 1.18)

  const sideMaterial = new THREE.MeshStandardMaterial({ color: '#252b2e', roughness: 0.82 })
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.12, 1.08), sideMaterial)
  slab.position.y = 0.06
  slab.castShadow = true
  slab.receiveShadow = true
  group.add(slab)

  const texture = createCorridorCardTexture(card.kind, doors, exits)
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(1.065, 1.065),
    new THREE.MeshBasicMaterial({ map: texture }),
  )
  top.rotation.x = -Math.PI / 2
  top.position.y = 0.121
  top.receiveShadow = true
  group.add(top)

  board.add(group)
  return group
}

export const createRoomTile = (
  board: THREE.Group,
  materials: Pick<SceneMaterials, 'floorPanel' | 'floorPanelDark'>,
  room: SavedRoom,
  entryDirection: Direction,
) => {
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
