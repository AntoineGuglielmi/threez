import * as THREE from 'three'
import type { BoardTile, Direction, RoomTile } from '../game/types'

export type BoardHit =
  | { type: 'room-placement'; direction: Direction }
  | { type: 'corridor-placement'; x: number; z: number }
  | { type: 'room'; room: RoomTile }
  | { type: 'tile'; tile: BoardTile }
  | { type: 'empty' }

type BoardHitTestOptions = {
  event: MouseEvent
  canvas: HTMLCanvasElement
  camera: THREE.Camera
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
  mode: 'room-placement' | 'corridor-placement' | 'normal'
  roomPlacementHighlights: THREE.Group
  placementHighlights: THREE.Group
  rooms: RoomTile[]
  boardTiles: BoardTile[]
}

/**
 * Converts a canvas click into a game-level target.
 * This module only resolves what was clicked; game rules and state changes
 * remain in the game orchestrator.
 */
export const resolveBoardHit = ({
  event,
  canvas,
  camera,
  raycaster,
  pointer,
  mode,
  roomPlacementHighlights,
  placementHighlights,
  rooms,
  boardTiles,
}: BoardHitTestOptions): BoardHit => {
  const bounds = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  if (mode === 'room-placement') {
    const hit = raycaster.intersectObjects(roomPlacementHighlights.children, true).find((intersection) => {
      let object: THREE.Object3D | null = intersection.object
      while (object && object.parent !== roomPlacementHighlights) object = object.parent
      return Boolean(object?.userData.isRoomPlacementMarker)
    })
    if (!hit) return { type: 'empty' }

    let marker: THREE.Object3D | null = hit.object
    while (marker && marker.parent !== roomPlacementHighlights) marker = marker.parent
    const direction = marker?.userData.roomPlacementDirection as Direction | undefined
    return direction ? { type: 'room-placement', direction } : { type: 'empty' }
  }

  if (mode === 'corridor-placement') {
    const hit = raycaster.intersectObjects(placementHighlights.children, true).find((intersection) => {
      let object: THREE.Object3D | null = intersection.object
      while (object && object.parent !== placementHighlights) object = object.parent
      return Boolean(object?.userData.isPlacementMarker)
    })
    if (!hit) return { type: 'empty' }

    let marker: THREE.Object3D | null = hit.object
    while (marker && marker.parent !== placementHighlights) marker = marker.parent
    if (!marker) return { type: 'empty' }

    return {
      type: 'corridor-placement',
      x: Number(marker.userData.placementX),
      z: Number(marker.userData.placementZ),
    }
  }

  const roomHit = raycaster.intersectObjects(rooms.map((room) => room.group), true)[0]
  if (roomHit) {
    let roomGroup: THREE.Object3D | null = roomHit.object
    while (roomGroup && !rooms.some((room) => room.group === roomGroup)) roomGroup = roomGroup.parent
    const room = rooms.find((item) => item.group === roomGroup)
    if (room) return { type: 'room', room }
  }

  const tileHit = raycaster.intersectObjects(boardTiles.map((tile) => tile.group), true)[0]
  if (!tileHit) return { type: 'empty' }

  let tileGroup: THREE.Object3D | null = tileHit.object
  while (tileGroup && !boardTiles.some((tile) => tile.group === tileGroup)) tileGroup = tileGroup.parent
  const tile = boardTiles.find((item) => item.group === tileGroup)
  return tile ? { type: 'tile', tile } : { type: 'empty' }
}
