import type { RoomCard, RoomDifficulty, RoomStatus } from './types'
import { shuffle } from './random'

const roomStatuses: RoomStatus[] = ['ordinary', 'ordinary', 'ordinary', 'locked', 'trapped']
const roomDifficulties: RoomDifficulty[] = ['easy', 'medium', 'hard']

export const createRoomCardFactory = (initialId = 1) => {
  let nextRoomCardId = initialId

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

  const createDeck = (size = 24) => shuffle(Array.from({ length: size }, createRoomCard))
  const getNextCardId = () => nextRoomCardId
  const setNextCardId = (id: number) => { nextRoomCardId = id }

  return { createRoomCard, createDeck, getNextCardId, setNextCardId }
}
