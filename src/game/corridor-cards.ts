import type { CorridorCard, CorridorKind, Direction } from './types'
import { corridorDefinitions, directionOrder } from './directions'
import { shuffle } from './random'

export const createCorridorCardFactory = (initialId: number) => {
  let nextCardId = initialId

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

  const allocateCardId = () => nextCardId++
  const getNextCardId = () => nextCardId
  const setNextCardId = (id: number) => { nextCardId = id }

  return {
    getWallDirections,
    createDoorDirections,
    createCard,
    createCorridorDeck,
    normalizeSavedCard,
    allocateCardId,
    getNextCardId,
    setNextCardId,
  }
}
