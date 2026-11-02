import { directionDelta, directionOrder, opposite, corridorDefinitions, rotateDirection } from './directions'
import type { BoardTile, CorridorCard, Direction, PlacementCandidate, RoomDifficulty, ResourceType, RoomTile, SurvivorKind } from './types'

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
  const rotationOrder = [turns, ...[0, 1, 2, 3].filter((rotation) => rotation !== turns)]

  // Build the candidate set from every empty cell touching the corridor network.
  // Starting only from a tile's exits can miss a valid cell when several tiles
  // meet around it or when the first tile considered is not the one that
  // ultimately provides the valid connection.
  const candidatePositions = new Map<string, { x: number; z: number }>()
  for (const tile of boardTiles) {
    for (const direction of directionOrder) {
      const [dx, dz] = directionDelta[direction]
      const x = tile.x + dx
      const z = tile.z + dz
      if (boardTiles.some((placed) => placed.x === x && placed.z === z) ||
        rooms.some((room) => room.x === x && room.z === z)) continue
      candidatePositions.set(`${x},${z}`, { x, z })
    }
  }

  for (const { x, z } of candidatePositions.values()) {
    const options: PlacementCandidate['options'] = []

    for (const rotation of rotationOrder) {
      const exits = definition.exits.map((direction) => rotateDirection(direction, rotation))
      const doors = card.doors.map((direction) => rotateDirection(direction, rotation))
      let hasConnection = false
      let hasConflict = false

      for (const direction of directionOrder) {
        const [dx, dz] = directionDelta[direction]
        const neighbourX = x + dx
        const neighbourZ = z + dz
        const neighbour = boardTiles.find((placed) => placed.x === neighbourX && placed.z === neighbourZ)
        const room = rooms.find((placed) => placed.x === neighbourX && placed.z === neighbourZ)

        if (room) {
          if (exits.includes(direction) || doors.includes(direction)) {
            hasConflict = true
            break
          }
          continue
        }

        if (!neighbour) continue

        const candidateOpens = exits.includes(direction)
        const neighbourOpens = neighbour.exits.includes(opposite[direction])
        if (candidateOpens !== neighbourOpens ||
          neighbour.doors.includes(opposite[direction])) {
          hasConflict = true
          break
        }

        if (candidateOpens && neighbourOpens) hasConnection = true
      }

      if (!hasConflict && hasConnection &&
        !options.some((option) => option.turns === rotation)) {
        options.push({ exits, turns: rotation })
      }
    }

    if (options.length > 0) candidates.set(`${x},${z}`, { x, z, options })
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
