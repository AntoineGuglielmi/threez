import { directionDelta, directionOrder, opposite, corridorDefinitions, rotateDirection } from './directions'
import type { BoardTile, CorridorCard, Direction, PlacementCandidate, RoomDifficulty, ResourceType, RoomTile, SurvivorKind } from './types'

type OccupiedRoom = Pick<RoomTile, 'x' | 'z' | 'direction'>
type CorridorPlacementInput = {
  card: CorridorCard
  turns: number
  boardTiles: BoardTile[]
  rooms: OccupiedRoom[]
}

export const getCorridorPlacements = ({ card, boardTiles, rooms }: CorridorPlacementInput): PlacementCandidate[] => {
  const candidates = new Map<string, PlacementCandidate>()

  // Every empty cell directly adjacent to the existing network is a possible
  // end-of-path placement. Connectivity is deliberately left to the player.
  for (const tile of boardTiles) {
    for (const direction of directionOrder) {
      const [dx, dz] = directionDelta[direction]
      const x = tile.x + dx
      const z = tile.z + dz
      if (boardTiles.some((placed) => placed.x === x && placed.z === z) ||
        rooms.some((room) => room.x === x && room.z === z)) continue

      const key = `${x},${z}`
      if (candidates.has(key)) continue
      const options = [0, 1, 2, 3].map((rotation) => ({
        exits: corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, rotation)),
        turns: rotation,
      }))
      candidates.set(key, { x, z, options })
    }
  }

  return [...candidates.values()]
}

export const getAvailableRoomDoors = (
  tile: Pick<BoardTile, 'x' | 'z' | 'doors' | 'usedDoors'>,
  boardTiles: Pick<BoardTile, 'x' | 'z' | 'exits'>[],
  rooms: Pick<RoomTile, 'x' | 'z'>[],
): Direction[] => tile.doors.filter((direction) => {
  if (tile.usedDoors.includes(direction)) return false
  const [dx, dz] = directionDelta[direction]
  const x = tile.x + dx
  const z = tile.z + dz

  if (boardTiles.some((placed) => placed.x === x && placed.z === z) ||
    rooms.some((room) => room.x === x && room.z === z)) return false

  // A room can occupy this cell only if no neighbouring corridor has
  // an exit pointing into it. The originating corridor has a door here.
  return !boardTiles.some((placed) => {
    const neighbourDirection = directionOrder.find((candidate) => {
      const [neighbourDx, neighbourDz] = directionDelta[candidate]
      return placed.x + neighbourDx === x && placed.z + neighbourDz === z
    })
    return neighbourDirection !== undefined && placed.exits.includes(neighbourDirection)
  })
})

export const resourceLabels: Record<ResourceType, string> = {
  cafe: 'Café',
  croissant: 'Croissant',
  citron: 'Citron',
  bonbon: 'Bonbon acidulé',
  munition: 'Munition',
}

export const getRoomResourceChances = (difficulty: RoomDifficulty, survivorKind: SurvivorKind = 'military') =>
  (Object.keys(resourceLabels) as ResourceType[]).map((resource) => {
    const threshold = Math.max(2, resourceThresholds[difficulty][resource] - (survivorKind === 'stealth' ? 1 : 0))
    return {
      resource,
      threshold,
      chancePercent: Math.round(((7 - threshold) / 6) * 100),
    }
  })

const resourceThresholds: Record<RoomDifficulty, Record<ResourceType, number>> = {
  easy: { cafe: 4, croissant: 3, citron: 4, bonbon: 3, munition: 4 },
  medium: { cafe: 5, croissant: 4, citron: 5, bonbon: 4, munition: 5 },
  hard: { cafe: 6, croissant: 5, citron: 6, bonbon: 5, munition: 6 },
}

export const rollRoomSearch = (
  difficulty: RoomDifficulty,
  rollDie: () => number = () => Math.floor(Math.random() * 6) + 1,
  survivorKind: SurvivorKind = 'military',
) => {
  const results = (Object.keys(resourceLabels) as ResourceType[]).map((resource) => {
    const value = rollDie()
    const threshold = Math.max(2, resourceThresholds[difficulty][resource] - (survivorKind === 'stealth' ? 1 : 0))
    return { resource, value, threshold, found: value >= threshold }
  })

  return {
    results,
    found: results.filter((result) => result.found).map(({ resource }) => resource),
  }
}
