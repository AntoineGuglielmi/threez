import { directionDelta, directionOrder, opposite, corridorDefinitions, rotateDirection } from './directions'
import type { BoardTile, CorridorCard, Direction, PlacementCandidate, RoomDifficulty, ResourceType, RoomTile } from './types'

type OccupiedRoom = Pick<RoomTile, 'x' | 'z'>
type CorridorPlacementInput = {
  card: CorridorCard
  turns: number
  boardTiles: BoardTile[]
  rooms: OccupiedRoom[]
}

export const getCorridorPlacements = ({
  card,
  turns,
  boardTiles,
  rooms,
}: CorridorPlacementInput): PlacementCandidate[] => {
  const candidates = new Map<string, PlacementCandidate>()
  const definition = corridorDefinitions[card.kind]

  for (const tile of boardTiles) {
    for (const exit of tile.exits) {
      const [dx, dz] = directionDelta[exit]
      const x = tile.x + dx
      const z = tile.z + dz
      if (boardTiles.some((placed) => placed.x === x && placed.z === z) ||
        rooms.some((room) => room.x === x && room.z === z)) continue

      const key = `${x},${z}`
      const candidate = candidates.get(key) ?? { x, z, options: [] }
      const exits = definition.exits.map((direction) => rotateDirection(direction, turns))
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
        candidate.options.push({ exits, turns })
      }
      if (candidate.options.length > 0) candidates.set(key, candidate)
    }
  }

  return [...candidates.values()]
}

export const getAvailableRoomDoors = (
  tile: Pick<BoardTile, 'x' | 'z' | 'doors' | 'usedDoors'>,
  boardTiles: Pick<BoardTile, 'x' | 'z'>[],
  rooms: OccupiedRoom[],
): Direction[] => tile.doors.filter((direction) => {
  if (tile.usedDoors.includes(direction)) return false
  const [dx, dz] = directionDelta[direction]
  const x = tile.x + dx
  const z = tile.z + dz
  return !boardTiles.some((placed) => placed.x === x && placed.z === z) &&
    !rooms.some((room) => room.x === x && room.z === z)
})

export const resourceLabels: Record<ResourceType, string> = {
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

export const rollRoomSearch = (
  difficulty: RoomDifficulty,
  rollDie: () => number = () => Math.floor(Math.random() * 6) + 1,
) => {
  const results = (Object.keys(resourceLabels) as ResourceType[]).map((resource) => {
    const value = rollDie()
    const threshold = resourceThresholds[difficulty][resource]
    return { resource, value, threshold, found: value >= threshold }
  })

  return {
    results,
    found: results.filter((result) => result.found).map(({ resource }) => resource),
  }
}
