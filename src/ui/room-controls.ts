import type { BoardTile, Direction, ResourceType, RoomCard, RoomDifficulty, RoomStatus, RoomTile, SurvivorKind } from '../game/types'

type RoomControlsOptions = {
  roomDeckCountElement: HTMLElement | null
  roomDoorOptionsElement: HTMLDivElement | null
  roomStateElement: HTMLElement | null
  drawRoomButton: HTMLButtonElement | null
  roomResultElement: HTMLDivElement | null
  unlockRoomButton: HTMLButtonElement | null
  returnRoomButton: HTMLButtonElement | null
  roomDeckLength: number
  rooms: RoomTile[]
  currentRoomId: number | null
  currentTile: BoardTile
  pendingRoomDraw: RoomCard | null
  phase: 'draw' | 'actions'
  activeSurvivorKind: SurvivorKind
  actionsRemaining: number
  availableDoors: Direction[]
  resourceLabels: Record<ResourceType, string>
  getRoomStatusLabel: (status: RoomStatus) => string
  getDifficultyLabel: (difficulty: RoomDifficulty) => string
  onSearchAgain: () => void
  onEnterRoom: (room: RoomTile) => void
}

export const renderRoomControls = ({
  roomDeckCountElement,
  roomDoorOptionsElement,
  roomStateElement,
  drawRoomButton,
  roomResultElement,
  unlockRoomButton,
  returnRoomButton,
  roomDeckLength,
  rooms,
  currentRoomId,
  currentTile,
  pendingRoomDraw,
  phase,
  activeSurvivorKind,
  actionsRemaining,
  availableDoors,
  resourceLabels,
  getRoomStatusLabel,
  getDifficultyLabel,
  onSearchAgain,
  onEnterRoom,
}: RoomControlsOptions) => {
  if (roomDeckCountElement) roomDeckCountElement.textContent = String(roomDeckLength)
  const roomSection = roomStateElement?.closest<HTMLElement>('.room-exploration')
  if (!roomDoorOptionsElement || !roomStateElement) return
  roomDoorOptionsElement.replaceChildren()
  const currentRoom = currentRoomId === null ? null : rooms.find((room) => room.id === currentRoomId) ?? null
  if (drawRoomButton) {
    drawRoomButton.disabled = phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId !== null || availableDoors.length === 0 || roomDeckLength === 0 || pendingRoomDraw !== null
    drawRoomButton.textContent = pendingRoomDraw ? 'Choisir un emplacement' : 'Piocher une pièce'
  }
  if (roomResultElement) roomResultElement.replaceChildren()
  if (roomSection) roomSection.hidden = !currentRoom
  if (currentRoom) {
    if (roomResultElement && currentRoom.lastRoll) {
      const resultHeading = document.createElement('strong')
      resultHeading.className = 'room-result-heading'
      resultHeading.textContent = 'Dernière fouille'
      const diceGrid = document.createElement('div')
      diceGrid.className = 'room-dice-results'
      currentRoom.lastRoll.forEach((result) => {
        const die = document.createElement('div')
        die.className = `room-die-result${result.found ? ' is-found' : ''}`
        const name = document.createElement('span')
        name.textContent = resourceLabels[result.resource]
        const value = document.createElement('strong')
        value.textContent = String(result.value)
        const threshold = document.createElement('small')
        threshold.textContent = `Seuil ${result.threshold}+`
        die.append(name, value, threshold)
        diceGrid.append(die)
      })
      roomResultElement.append(resultHeading, diceGrid)
      const foundResources = currentRoom.lastRoll.filter((result) => result.found)
      const loot = document.createElement('p')
      loot.className = 'room-result-loot'
      loot.textContent = foundResources.length
        ? `Trouvé : ${foundResources.map((result) => resourceLabels[result.resource]).join(', ')}`
        : 'Aucune ressource trouvée'
      roomResultElement.append(loot)
    }
    const statusLabel = currentRoom.status === 'locked' && currentRoom.unlocked ? 'Déverrouillée' : getRoomStatusLabel(currentRoom.status)
    roomStateElement.textContent = `Pièce ${String(currentRoom.id).padStart(2, '0')} · ${statusLabel} · ${getDifficultyLabel(currentRoom.difficulty)}${currentRoom.searched ? ' · Déjà fouillée' : ''}`
    if (unlockRoomButton) {
      unlockRoomButton.hidden = currentRoom.status !== 'locked' || currentRoom.unlocked
      unlockRoomButton.disabled = phase !== 'actions' || actionsRemaining <= 0
    }
    if (returnRoomButton) {
      returnRoomButton.hidden = false
      returnRoomButton.disabled = phase !== 'actions' || actionsRemaining <= 0
    }
    if (currentRoom.status === 'locked' && !currentRoom.unlocked) {
      roomDoorOptionsElement.textContent = 'Porte verrouillée'
    } else if (currentRoom.status === 'trapped' && activeSurvivorKind !== 'stealth') {
      roomDoorOptionsElement.textContent = 'Piège : seul le survivant furtif peut fouiller cette pièce.'
    } else {
      const searchButton = document.createElement('button')
      searchButton.type = 'button'
      searchButton.className = 'action-button primary'
      searchButton.disabled = phase !== 'actions' || actionsRemaining <= 0
      searchButton.textContent = currentRoom.searched ? 'Fouiller à nouveau · 1 action' : 'Fouiller · 1 action'
      searchButton.addEventListener('click', onSearchAgain)
      roomDoorOptionsElement.append(searchButton)
    }
    return
  }

  if (unlockRoomButton) unlockRoomButton.hidden = true
  if (returnRoomButton) returnRoomButton.hidden = true
  if (pendingRoomDraw) {
    const note = document.createElement('p')
    note.className = 'room-draw-prompt'
    note.textContent = 'Pièce piochée : cliquez sur un emplacement lumineux du plateau.'
    roomDoorOptionsElement.append(note)
  }
}
