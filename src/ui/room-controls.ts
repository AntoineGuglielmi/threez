import type { RoomCard, RoomTile, SurvivorKind } from '../game/types'

type RoomControlsOptions = {
  roomDoorOptionsElement: HTMLDivElement | null
  drawRoomButton: HTMLElement | null
  currentRoomId: number | null
  pendingRoomDraw: RoomCard | null
  phase: 'draw' | 'actions'
  activeSurvivorKind: SurvivorKind
  actionsRemaining: number
  hasAvailableDoors: boolean
  rooms: RoomTile[]
  onSearchRoom: () => void
}

export const renderRoomControls = ({
  roomDoorOptionsElement,
  drawRoomButton,
  currentRoomId,
  pendingRoomDraw,
  phase,
  activeSurvivorKind,
  actionsRemaining,
  hasAvailableDoors,
  rooms,
  onSearchRoom,
}: RoomControlsOptions) => {
  const roomSection = roomDoorOptionsElement?.closest<HTMLElement>('.room-exploration')
  const currentRoom = currentRoomId === null
    ? null
    : rooms.find((room) => room.id === currentRoomId) ?? null

  if (drawRoomButton) {
    drawRoomButton.removeAttribute('aria-disabled')
    drawRoomButton.classList.remove('is-disabled')
  }

  if (!roomDoorOptionsElement || !roomSection) return
  roomDoorOptionsElement.replaceChildren()
  roomSection.hidden = currentRoom === null
  if (!currentRoom) return

  const needsHeavy = currentRoom.status === 'locked' && !currentRoom.unlocked
  const cannotSearchTrap = currentRoom.status === 'trapped' && activeSurvivorKind !== 'stealth'
  const cannotOpenLockedRoom = needsHeavy && activeSurvivorKind !== 'heavy'
  const searchButton = document.createElement('button')
  searchButton.type = 'button'
  searchButton.className = 'action-button primary'
  searchButton.textContent = 'Fouiller la pièce'
  searchButton.disabled = phase !== 'actions' || actionsRemaining <= 0 ||
    cannotSearchTrap || cannotOpenLockedRoom || activeSurvivorKind === 'injured'

  if (cannotSearchTrap) {
    searchButton.title = 'Seul le Furtif peut fouiller une pièce piégée.'
  } else if (cannotOpenLockedRoom) {
    searchButton.title = 'Le Costaud doit fouiller cette pièce en premier.'
  }
  searchButton.addEventListener('click', onSearchRoom)
  roomDoorOptionsElement.append(searchButton)
}
