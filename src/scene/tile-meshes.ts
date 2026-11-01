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
  _materials: Pick<SceneMaterials, 'floorPanel' | 'floorPanelDark'>,
  room: SavedRoom,
  _entryDirection: Direction,
) => {
  const group = new THREE.Group()
  group.position.set(room.x * 1.18, 0.025, room.z * 1.18)

  const side = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.12, 1.08),
    new THREE.MeshStandardMaterial({ color: '#252b2e', roughness: 0.82 }),
  )
  side.position.y = 0.06
  side.castShadow = true
  side.receiveShadow = true
  group.add(side)

  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(1.065, 1.065),
    new THREE.MeshBasicMaterial({ map: createRoomCardTexture() }),
  )
  top.rotation.x = -Math.PI / 2
  top.position.y = 0.121
  top.receiveShadow = true
  group.add(top)

  board.add(group)
  return group
}
