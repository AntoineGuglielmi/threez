import * as THREE from 'three'
import { directionDelta } from '../game/directions'
import type { BoardTile, CorridorCard, Direction, SavedRoom } from '../game/types'
import type { createScene } from '../scene'

type SceneMaterials = ReturnType<typeof createScene>['materials']
type CorridorMaterials = Pick<SceneMaterials, 'start' | 'startTop' | 'floorPanel' | 'floorPanelDark' | 'corridorWall' | 'tileNeon'>

export const createCorridorTile = (
  board: THREE.Group,
  materials: CorridorMaterials,
  card: CorridorCard,
  x: number,
  z: number,
  exits: Direction[],
  doors: Direction[] = [],
  usedDoors: Direction[] = [],
) => {
  const group = new THREE.Group()
  group.position.set(x * 1.18, 0.025, z * 1.18)

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
