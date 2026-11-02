import * as THREE from 'three'
import './style.css'
import { createScene } from './scene'
import { directionDelta, opposite, corridorDefinitions, rotateDirection } from './game/directions'
import { readSavedGameState, STORAGE_KEY } from './game/persistence'
import { shuffle } from './game/random'
import { createCorridorCardFactory } from './game/corridor-cards'
import { getCorridorPixelRotation } from './game/corridor-pixel-templates'
import { createRoomCardFactory } from './game/room-cards'
import { getCorridorPlacements, getRoomResourceChances, resourceLabels, rollRoomSearch } from './game/rules'
import { evaluateCorridorMove } from './game/movement'
import { createCorridorHandCard } from './ui/corridor-hand-card'
import { setupBoardViewport } from './ui/board-viewport'
import { resolveBoardHit } from './ui/board-hit-testing'
import { renderRoomControls } from './ui/room-controls'
import { createCorridorTile, createRoomTile } from './scene/tile-meshes'
import type { BoardTile, CorridorCard, CorridorKind, Direction, PlacementCandidate, PlacementOption, ResourceType, RoomCard, RoomDifficulty, RoomTile, SavedGameState, SavedRoom, SurvivorCards, SurvivorKind } from './game/types'

let activeSurvivorKind: SurvivorKind = 'stealth'
const sceneSetup = createScene(activeSurvivorKind)
const { root, scene, camera, renderer, materials, board, start, activeRing, beacon, characterKeyLight, characterFillLight, warmRimLight, otherCharacters } = sceneSetup
let activeCharacter = sceneSetup.activeCharacter
const savedGameState = readSavedGameState()

const corridorCards = createCorridorCardFactory(savedGameState?.nextCardId ?? 1)
const { createCorridorDeck, normalizeSavedCard } = corridorCards

const roomCards = createRoomCardFactory()
const generatedRoomDeck = roomCards.createDeck()
const roomDeck: RoomCard[] = savedGameState?.roomDeck ?? generatedRoomDeck
let pendingRoomDraw: RoomCard | null = savedGameState?.pendingRoomDraw ?? null
const createResourceInventory = (source?: Partial<Record<ResourceType, number>>): Record<ResourceType, number> => ({
  cafe: source?.cafe ?? 0,
  croissant: source?.croissant ?? 0,
  citron: source?.citron ?? 0,
  bonbon: source?.bonbon ?? 0,
  munition: source?.munition ?? 0,
})
const resourceOwnerOnLegacySave = savedGameState?.activeSurvivorKind ?? 'stealth'
const resourcesBySurvivor: Record<SurvivorKind, Record<ResourceType, number>> = {
  stealth: createResourceInventory(savedGameState?.resourcesBySurvivor?.stealth),
  heavy: createResourceInventory(savedGameState?.resourcesBySurvivor?.heavy),
  military: createResourceInventory(savedGameState?.resourcesBySurvivor?.military),
  scientist: createResourceInventory(savedGameState?.resourcesBySurvivor?.scientist),
  injured: createResourceInventory(savedGameState?.resourcesBySurvivor?.injured),
}
if (!savedGameState?.resourcesBySurvivor && savedGameState?.resources) {
  resourcesBySurvivor[resourceOwnerOnLegacySave] = createResourceInventory(savedGameState.resources)
}
const rooms: RoomTile[] = []
let currentRoomId: number | null = savedGameState?.currentRoomId ?? null
if (savedGameState?.nextRoomCardId) roomCards.setNextCardId(savedGameState.nextRoomCardId)
const legacyOwner = savedGameState?.activeSurvivorKind ?? 'stealth'
const survivorCards = {} as Record<SurvivorKind, SurvivorCards>
for (const kind of ['stealth', 'heavy', 'military', 'scientist', 'injured'] as SurvivorKind[]) {
  const savedCards = savedGameState?.survivorCards?.[kind]
  if (savedCards) {
    survivorCards[kind] = {
      deck: savedCards.deck.map(normalizeSavedCard),
      discard: savedCards.discard.map(normalizeSavedCard),
      hand: savedCards.hand.map(normalizeSavedCard),
    }
  } else if (savedGameState && kind === legacyOwner) {
    survivorCards[kind] = {
      deck: savedGameState.deck.map(normalizeSavedCard),
      discard: savedGameState.discard.map(normalizeSavedCard),
      hand: savedGameState.hand.map(normalizeSavedCard),
    }
  } else {
    survivorCards[kind] = { deck: createCorridorDeck(), discard: [], hand: [] }
  }
}
let corridorDeck = survivorCards[legacyOwner].deck
let discardPile = survivorCards[legacyOwner].discard
let hand = survivorCards[legacyOwner].hand
let pendingDraw: CorridorCard | null = savedGameState?.pendingDraw ? normalizeSavedCard(savedGameState.pendingDraw) : null
let phase: 'draw' | 'actions' = savedGameState ? (savedGameState.phase ?? 'actions') : 'draw'
let selectedCardId: number | null = null
let selectedCardTurns = 0
let pendingRoomTurns = 0
let actionsRemaining = savedGameState?.actionsRemaining ?? 7
let turnNumber = savedGameState?.turnNumber ?? 1
if (savedGameState) corridorCards.setNextCardId(savedGameState.nextCardId)
if (savedGameState) {
  const highestCardId = Object.values(survivorCards).flatMap((cards) => [...cards.deck, ...cards.discard, ...cards.hand]).reduce((highest, card) => Math.max(highest, card.id), 0)
  corridorCards.setNextCardId(Math.max(corridorCards.getNextCardId(), highestCardId + 1))
}
const boardTiles: BoardTile[] = [{
  x: 0,
  z: 0,
  kind: 'start',
  exits: ['S'],
  doors: [],
  usedDoors: [],
  group: start,
}]

let currentTile = boardTiles[0]
const characterModels: Record<SurvivorKind, THREE.Group> = {
  stealth: activeCharacter,
  heavy: otherCharacters.find((item) => item.kind === 'heavy')!.character,
  military: otherCharacters.find((item) => item.kind === 'military')!.character,
  scientist: otherCharacters.find((item) => item.kind === 'scientist')!.character,
  injured: otherCharacters.find((item) => item.kind === 'injured')!.character,
}
const survivorPositions: Record<SurvivorKind, { x: number; z: number; roomId: number | null }> = {
  stealth: { x: 0, z: 0, roomId: null },
  heavy: { x: 0, z: 0, roomId: null },
  military: { x: 0, z: 0, roomId: null },
  scientist: { x: 0, z: 0, roomId: null },
  injured: { x: 0, z: 0, roomId: null },
}
if (savedGameState?.survivors) {
  for (const kind of Object.keys(survivorPositions) as SurvivorKind[]) {
    const saved = savedGameState.survivors[kind]
    if (saved) survivorPositions[kind] = { ...saved }
  }
} else if (savedGameState?.survivor) {
  survivorPositions.stealth = { ...savedGameState.survivor, roomId: savedGameState.currentRoomId ?? null }
}
let characterOrder: SurvivorKind[] = savedGameState?.characterOrder ?? ['stealth', ...shuffle(['heavy', 'military', 'scientist'] as SurvivorKind[]), 'injured']
let characterIndex = savedGameState?.characterIndex ?? 0
let injuredMovedThisTurn = savedGameState?.injuredMovedThisTurn ?? false
if (savedGameState?.activeSurvivorKind && characterOrder.includes(savedGameState.activeSurvivorKind)) {
  activeSurvivorKind = savedGameState.activeSurvivorKind
  characterIndex = characterOrder.indexOf(activeSurvivorKind)
}
let placementPreview: { x: number; z: number; options: PlacementOption[]; optionIndex: number } | null = null
let boardEditMode = false
let selectedBoardCard: { type: 'tile'; tile: BoardTile } | { type: 'room'; room: RoomTile } | null = null
const placementHighlights = new THREE.Group()
placementHighlights.name = 'placement-highlights'
board.add(placementHighlights)
const roomPlacementHighlights = new THREE.Group()
roomPlacementHighlights.name = 'room-placement-highlights'
board.add(roomPlacementHighlights)
const ghostLayer = new THREE.Group()
ghostLayer.name = 'corridor-placement-ghost'
scene.add(ghostLayer)
let ghostTile: THREE.Group | null = null
const placementActions = document.querySelector<HTMLDivElement>('#placement-actions')
const rotateGhostButton = document.querySelector<HTMLButtonElement>('#rotate-ghost')
const confirmGhostButton = document.querySelector<HTMLButtonElement>('#confirm-ghost')
const rotateRoomPlacementButton = document.querySelector<HTMLButtonElement>('#rotate-room-placement')
const rotateGhostButtonElement = document.querySelector<HTMLButtonElement>('#rotate-ghost')
const editModeButton = document.querySelector<HTMLButtonElement>('#toggle-edit-mode')
const boardEditActions = document.querySelector<HTMLDivElement>('#board-edit-actions')
const boardEditLabel = document.querySelector<HTMLSpanElement>('#board-edit-label')
const rotateBoardCardButton = document.querySelector<HTMLButtonElement>('#rotate-board-card')
const closeBoardEditButton = document.querySelector<HTMLButtonElement>('#close-board-edit')

const handElement = document.querySelector<HTMLDivElement>('#cc-hand')
const deckCountElement = document.querySelector<HTMLElement>('#cc-deck-count')
const discardCountElement = document.querySelector<HTMLElement>('#cc-discard-count')
const actionsCountElement = document.querySelector<HTMLElement>('#actions-count')
const actionsFillElement = document.querySelector<HTMLDivElement>('#actions-fill')
const resourceElements: Record<ResourceType, HTMLElement | null> = {
  cafe: document.querySelector<HTMLElement>('#resource-cafe'),
  croissant: document.querySelector<HTMLElement>('#resource-croissant'),
  citron: document.querySelector<HTMLElement>('#resource-citron'),
  bonbon: document.querySelector<HTMLElement>('#resource-bonbon'),
  munition: document.querySelector<HTMLElement>('#resource-munition'),
}
const statusElement = document.querySelector<HTMLParagraphElement>('#game-status')
const drawButton = document.querySelector<HTMLElement>('#draw-cc')
const placeButton = document.querySelector<HTMLButtonElement>('#place-cc')
const rotateButton = document.querySelector<HTMLButtonElement>('#rotate-cc')
const cancelPlacementButton = document.querySelector<HTMLButtonElement>('#cancel-placement')
const discardButton = document.querySelector<HTMLButtonElement>('#discard-cc')
const replaceButton = document.querySelector<HTMLButtonElement>('#replace-cc')
const endTurnButton = document.querySelector<HTMLButtonElement>('#end-turn')
const turnLabel = document.querySelector<HTMLElement>('.turn-tag')

const setStatus = (message: string) => {
  if (statusElement) statusElement.textContent = message
}

const getSurvivorLabel = (kind: SurvivorKind) => ({
  stealth: 'Furtif', heavy: 'Costaud', military: 'Militaire', scientist: 'Scientifique', injured: 'Blessé',
})[kind]

const globalResourceInventoryElement = document.querySelector<HTMLDivElement>('#global-resource-inventory')
const survivorKinds: SurvivorKind[] = ['stealth', 'heavy', 'military', 'scientist', 'injured']
const renderGlobalResourceInventory = () => {
  if (!globalResourceInventoryElement) return
  const resourceOrder: ResourceType[] = ['cafe', 'croissant', 'citron', 'bonbon', 'munition']
  const totals = createResourceInventory()
  survivorKinds.forEach((kind) => {
    resourceOrder.forEach((resource) => { totals[resource] += resourcesBySurvivor[kind][resource] })
  })
  const table = document.createElement('div')
  table.className = 'global-resource-table'
  const header = document.createElement('div')
  header.className = 'global-resource-row global-resource-header'
  const resourceHeading = document.createElement('span')
  resourceHeading.textContent = 'Ressource'
  header.append(resourceHeading)
  survivorKinds.forEach((kind) => {
    const heading = document.createElement('span')
    heading.textContent = getSurvivorLabel(kind)
    heading.title = getSurvivorLabel(kind)
    header.append(heading)
  })
  const totalHeading = document.createElement('strong')
  totalHeading.textContent = 'Total'
  header.append(totalHeading)
  table.append(header)
  resourceOrder.forEach((resource) => {
    const row = document.createElement('div')
    row.className = 'global-resource-row'
    const name = document.createElement('span')
    name.textContent = resourceLabels[resource]
    row.append(name)
    survivorKinds.forEach((kind) => {
      const value = document.createElement('span')
      value.textContent = String(resourcesBySurvivor[kind][resource])
      row.append(value)
    })
    const total = document.createElement('strong')
    total.textContent = String(totals[resource])
    row.append(total)
    table.append(row)
  })
  globalResourceInventoryElement.replaceChildren(table)
}

const getDifficultyLabel = (difficulty: RoomDifficulty) => ({
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Difficile',
})[difficulty]

const rollRoomDice = (room: RoomTile) => {
  const { results, found } = rollRoomSearch(room.difficulty, undefined, activeSurvivorKind)
  found.forEach((resource) => { resourcesBySurvivor[activeSurvivorKind][resource] += 1 })
  room.lastRoll = results
  room.searched = true
  setStatus(found.length
    ? `Fouille ${getDifficultyLabel(room.difficulty).toLowerCase()} : ${results.map((result) => `${resourceLabels[result.resource]} ${result.value}/6`).join(' · ')}. Trouvé : ${found.map((resource) => resourceLabels[resource]).join(', ')}.`
    : `Fouille ${getDifficultyLabel(room.difficulty).toLowerCase()} : ${results.map((result) => `${resourceLabels[result.resource]} ${result.value}/6`).join(' · ')}. Aucune ressource trouvée.`)
  saveGameState()
  renderGameUi()
}

// Setup: two straight corridor cards are placed between the start tile and the unexplored area.
const setupCorridor = () => {
  for (let index = 1; index <= 2; index += 1) {
    const deckIndex = corridorDeck.findIndex((card) => card.kind === 'straight')
    if (deckIndex < 0) throw new Error('Not enough straight corridor cards for setup')
    const [card] = corridorDeck.splice(deckIndex, 1)
    const x = 0
    const z = index
    const exits: Direction[] = ['N', 'S']
    const doors: Direction[] = []
    const group = createCorridorTile(board, materials, card, x, z, exits, doors)
    boardTiles.push({ x, z, kind: card.kind, exits, doors, usedDoors: [], group })
  }
}

if (savedGameState?.tiles.length) {
  for (const tile of savedGameState.tiles) {
    const isInitialCorridor = tile.x === 0 && (tile.z === 1 || tile.z === 2)
    const card = normalizeSavedCard({
      id: corridorCards.allocateCardId(),
      kind: tile.kind,
      doors: isInitialCorridor ? [] : tile.doors ?? [],
    }, getCorridorPixelRotation(tile.kind, tile.exits))
    const doors = card.doors
    const usedDoors = [...(tile.usedDoors ?? [])]
    const group = createCorridorTile(board, materials, card, tile.x, tile.z, tile.exits, doors, usedDoors)
    boardTiles.push({ ...tile, exits: [...tile.exits], doors: [...doors], usedDoors, group })
  }
} else {
  setupCorridor()
}


if (savedGameState?.rooms) {
  for (const savedRoom of savedGameState.rooms) {
    const group = createRoomTile(board, materials, savedRoom, opposite[savedRoom.direction])
    rooms.push({ ...savedRoom, group })
  }
}
if (savedGameState?.nextRoomCardId) roomCards.setNextCardId(savedGameState.nextRoomCardId)

const survivorTokenPositions: Record<SurvivorKind, [number, number, number]> = {
  stealth: [0, 0.19, 0.16],
  heavy: [-0.32, 0.19, -0.28],
  military: [0.32, 0.19, -0.28],
  scientist: [-0.32, 0.19, 0.36],
  injured: [0.32, 0.19, 0.36],
}
const getSurvivorTokenPosition = (kind: SurvivorKind): [number, number, number] => survivorTokenPositions[kind]

const placeSurvivorModel = (kind: SurvivorKind, makeActive: boolean) => {
  const model = characterModels[kind]
  model.parent?.remove(model)
  model.scale.setScalar(makeActive ? 0.72 : 0.27)
  const position = survivorPositions[kind]
  const tile = boardTiles.find((item) => item.x === position.x && item.z === position.z) ?? boardTiles[0]
  const room = position.roomId === null ? null : rooms.find((item) => item.id === position.roomId) ?? null
  const parent = room?.group ?? tile.group
  parent.add(model)
  const [offsetX, , offsetZ] = makeActive ? [0, 0.19, room ? 0 : 0.16] : getSurvivorTokenPosition(kind)
  model.position.set(offsetX, 0.19, offsetZ)
  if (makeActive) {
    parent.add(activeRing, characterKeyLight, characterFillLight, warmRimLight)
    activeRing.position.set(0, 0.183, room ? 0 : 0.16)
  }
  return { tile, room }
}

const activateSurvivor = (kind: SurvivorKind) => {
  survivorCards[activeSurvivorKind] = { deck: corridorDeck, discard: discardPile, hand }
  const previousKind = activeSurvivorKind
  const previousModel = characterModels[previousKind]
  const previousPosition = survivorPositions[previousKind]
  const previousTile = boardTiles.find((tile) => tile.x === previousPosition.x && tile.z === previousPosition.z) ?? currentTile
  const previousRoom = previousPosition.roomId === null ? null : rooms.find((room) => room.id === previousPosition.roomId) ?? null
  previousModel.parent?.remove(previousModel, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  previousModel.scale.setScalar(0.27)
  ;(previousRoom?.group ?? previousTile.group).add(previousModel)
  const [previousX, , previousZ] = getSurvivorTokenPosition(previousKind)
  previousModel.position.set(previousX, 0.19, previousRoom ? 0 : previousZ)

  activeSurvivorKind = kind
  corridorDeck = survivorCards[kind].deck
  discardPile = survivorCards[kind].discard
  hand = survivorCards[kind].hand
  activeCharacter = characterModels[kind]
  const restored = placeSurvivorModel(kind, true)
  currentTile = restored.tile
  currentRoomId = restored.room?.id ?? null
}

for (const kind of Object.keys(characterModels) as SurvivorKind[]) {
  if (kind !== activeSurvivorKind) placeSurvivorModel(kind, false)
}
activateSurvivor(activeSurvivorKind)

const getPlacements = (card: CorridorCard, fixedTurns = selectedCardTurns): PlacementCandidate[] =>
  getCorridorPlacements({ card, turns: fixedTurns, boardTiles, rooms })

const disposeGroup = (group: THREE.Group) => {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    meshMaterials.forEach((material) => material.dispose())
  })
  group.clear()
}

const clearGhostTile = () => {
  if (ghostTile) {
    ghostLayer.remove(ghostTile)
    disposeGroup(ghostTile)
    ghostTile = null
  }
  if (placementActions) placementActions.hidden = true
  if (rotateRoomPlacementButton) rotateRoomPlacementButton.hidden = true
  if (rotateGhostButtonElement) rotateGhostButtonElement.hidden = false
  if (confirmGhostButton) confirmGhostButton.hidden = false
}

const createGhostTile = () => {
  clearGhostTile()
  if (!placementPreview || selectedCardId === null) return
  const card = hand.find((item) => item.id === selectedCardId)
  if (!card) return
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, selectedCardTurns))
  const doors = card.doors.map((direction) => rotateDirection(direction, selectedCardTurns))
  const ghost = createCorridorTile(board, materials, card, placementPreview.x, placementPreview.z, exits, doors)
  board.remove(ghost)
  ghost.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = false
    object.receiveShadow = false
    const originalMaterial = object.material
    const sourceMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial]
    const ghostMaterials = sourceMaterials.map((source) => {
      const material = source.clone()
      material.transparent = true
      material.opacity = 0.48
      material.depthWrite = false
      return material
    })
    object.material = Array.isArray(originalMaterial) ? ghostMaterials : ghostMaterials[0]
  })
  ghostTile = ghost
  ghostLayer.add(ghost)
  if (placementActions) placementActions.hidden = false
  if (rotateRoomPlacementButton) rotateRoomPlacementButton.hidden = true
}

const updatePlacementHighlights = () => {
  disposeGroup(placementHighlights)
  disposeGroup(roomPlacementHighlights)

  if (phase === 'actions' && selectedCardId !== null && !pendingDraw && activeSurvivorKind !== 'injured') {
    const card = hand.find((item) => item.id === selectedCardId)
    if (card) {
      for (const candidate of getPlacements(card, selectedCardTurns)) {
        const isSelected = placementPreview?.x === candidate.x && placementPreview?.z === candidate.z
        const marker = new THREE.Group()
        marker.name = 'placement-marker'
        marker.userData.isPlacementMarker = true
        marker.userData.placementX = candidate.x
        marker.userData.placementZ = candidate.z
        marker.position.set(candidate.x * 1.18, 0.19, candidate.z * 1.18)

        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 0.94),
          new THREE.MeshBasicMaterial({
            color: isSelected ? '#bd9878' : '#9a8067',
            transparent: true,
            opacity: isSelected ? 0.2 : 0.09,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        )
        pad.rotation.x = -Math.PI / 2
        marker.add(pad)
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(isSelected ? 0.39 : 0.34, isSelected ? 0.43 : 0.37, 4),
          new THREE.MeshBasicMaterial({
            color: isSelected ? '#ead8c7' : '#bd9878',
            transparent: true,
            opacity: isSelected ? 1 : 0.72,
            side: THREE.DoubleSide,
          }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.006
        marker.add(ring)

        const selectedOption = candidate.options.find((option) => option.turns === selectedCardTurns) ?? candidate.options[0]
        for (const direction of selectedOption?.exits ?? []) {
          const [dx, dz] = directionDelta[direction]
          const exitMarker = new THREE.Mesh(
            new THREE.BoxGeometry(dx === 0 ? 0.22 : 0.055, 0.018, dz === 0 ? 0.22 : 0.055),
            new THREE.MeshBasicMaterial({ color: '#bd9878' }),
          )
          exitMarker.position.set(dx * 0.43, 0.02, dz * 0.43)
          marker.add(exitMarker)
        }
        for (const direction of card.doors.map((item) => rotateDirection(item, selectedOption?.turns ?? selectedCardTurns)).filter((item) => !selectedOption?.exits.includes(item))) {
          const [dx, dz] = directionDelta[direction]
          const doorMarker = new THREE.Mesh(
            new THREE.BoxGeometry(dx === 0 ? 0.22 : 0.055, 0.018, dz === 0 ? 0.22 : 0.055),
            new THREE.MeshBasicMaterial({ color: '#c18b66' }),
          )
          doorMarker.position.set(dx * 0.43, 0.024, dz * 0.43)
          marker.add(doorMarker)
        }
        placementHighlights.add(marker)
      }
    }
  }

  if (pendingRoomDraw && currentRoomId === null && activeSurvivorKind !== 'injured') {
    if (placementActions) placementActions.hidden = false
    if (rotateRoomPlacementButton) rotateRoomPlacementButton.hidden = false
    if (rotateGhostButtonElement) rotateGhostButtonElement.hidden = true
    if (confirmGhostButton) confirmGhostButton.hidden = true
    for (const candidate of getAvailableDoors()) {
      const marker = new THREE.Group()
      marker.name = 'room-placement-marker'
      marker.userData.isRoomPlacementMarker = true
      marker.userData.roomPlacementDirection = candidate.direction
      marker.userData.roomPlacementX = candidate.x
      marker.userData.roomPlacementZ = candidate.z
      marker.userData.roomPlacementOriginX = candidate.originX
      marker.userData.roomPlacementOriginZ = candidate.originZ
      marker.position.set(candidate.x * 1.18, 0.19, candidate.z * 1.18)
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 0.94),
        new THREE.MeshBasicMaterial({ color: '#d99a75', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      )
      pad.rotation.x = -Math.PI / 2
      marker.add(pad)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.34, 0.4, 4),
        new THREE.MeshBasicMaterial({ color: '#c18b66', side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.006
      marker.add(ring)
      roomPlacementHighlights.add(marker)
    }
  }

  createGhostTile()
  if (pendingRoomDraw) {
    if (placementActions) placementActions.hidden = false
    if (rotateRoomPlacementButton) rotateRoomPlacementButton.hidden = false
    if (rotateGhostButtonElement) rotateGhostButtonElement.hidden = true
    if (confirmGhostButton) confirmGhostButton.hidden = true
  }
}
const spendAction = () => {
  actionsRemaining = Math.max(0, actionsRemaining - 1)
  if (actionsRemaining === 0) setStatus('Plus d’actions. Terminez le tour pour continuer.')
}

const confirmPlacement = () => {
  if (phase !== 'actions') return
  const card = hand.find((item) => item.id === selectedCardId)
  if (!card || !placementPreview) return
  const { x, z } = placementPreview
  const validCandidate = getPlacements(card, selectedCardTurns).find((candidate) => candidate.x === x && candidate.z === z)
  const validOption = validCandidate?.options.find((option) => option.turns === selectedCardTurns)
  if (!validCandidate || !validOption || boardTiles.some((tile) => tile.x === x && tile.z === z)) {
    setStatus('Cette orientation ne convient pas à cet emplacement. Tournez la carte ou choisissez un autre emplacement.')
    return
  }

  const doors = card.doors.map((direction) => rotateDirection(direction, selectedCardTurns))
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, selectedCardTurns))
  const group = createCorridorTile(board, materials, card, x, z, exits, doors)
  const placedTile: BoardTile = { x, z, kind: card.kind, exits, doors, usedDoors: [], group }
  boardTiles.push(placedTile)

  hand = hand.filter((item) => item.id !== card.id)
  selectedCardId = null
  placementPreview = null
  clearGhostTile()
  setStatus('Couloir posé. Le déplacement reste à effectuer séparément.')
  saveGameState()
  renderGameUi()
}

const drawCorridorCard = () => {
  if (phase !== 'draw' || activeSurvivorKind === 'injured' || hand.length >= 3) return

  if (corridorDeck.length === 0 && discardPile.length > 0) {
    corridorDeck.push(...shuffle(discardPile.splice(0, discardPile.length)))
  }

  const card = corridorDeck.pop()
  if (!card) {
    phase = 'actions'
    setStatus('La pioche est épuisée. Vous pouvez passer aux actions.')
  } else {
    hand.push(card)
    setStatus(hand.length >= 3
      ? 'Main complète. Phase d’actions.'
      : `Couloir pioché. Encore ${3 - hand.length} carte${3 - hand.length > 1 ? 's' : ''} à piocher.`)
  }

  if (hand.length >= 3) phase = 'actions'
  selectedCardId = null
  placementPreview = null
  pendingDraw = null
  saveGameState()
  renderGameUi()
}


const roomDoorOptionsElement = document.querySelector<HTMLDivElement>('#cp-door-options')
const drawRoomButton = document.querySelector<HTMLElement>('#draw-cp')

type RoomPlacementCandidate = {
  x: number
  z: number
  direction: Direction
  originX: number
  originZ: number
  tile: BoardTile
}

const getAvailableDoors = (): RoomPlacementCandidate[] => currentTile.doors
  .filter((direction) => !currentTile.usedDoors.includes(direction))
  .map((direction) => {
    const [dx, dz] = directionDelta[direction]
    return {
      x: currentTile.x + dx,
      z: currentTile.z + dz,
      direction,
      originX: currentTile.x,
      originZ: currentTile.z,
      tile: currentTile,
    }
  })
  .filter(({ x, z }) =>
    !boardTiles.some((tile) => tile.x === x && tile.z === z) &&
    !rooms.some((room) => room.x === x && room.z === z),
  )

const drawRoomCard = () => {
  if (activeSurvivorKind === 'injured' || currentRoomId !== null || pendingRoomDraw) return
  if (getAvailableDoors().length === 0) {
    setStatus('Aucune porte libre sur les couloirs déjà posés.')
    return
  }
  const card = roomDeck.pop()
  if (!card) {
    setStatus('La pioche de pièces est vide.')
    renderGameUi()
    return
  }
  pendingRoomDraw = card
  pendingRoomTurns = 0
  selectedCardId = null
  placementPreview = null
  setStatus('Pièce piochée. Choisissez un emplacement lumineux sur le plateau.')
  saveGameState()
  renderGameUi()
}

const placeDrawnRoom = (candidate: RoomPlacementCandidate) => {
  if (!pendingRoomDraw || currentRoomId !== null) return
  const availableCandidate = getAvailableDoors().find(({ x, z, direction, originX, originZ }) =>
    x === candidate.x && z === candidate.z && direction === candidate.direction &&
    originX === candidate.originX && originZ === candidate.originZ,
  )
  if (!availableCandidate) return
  const { x, z, direction, tile } = availableCandidate
  const card = pendingRoomDraw
  const room: SavedRoom = { ...card, x, z, originX: tile.x, originZ: tile.z, direction: rotateDirection(direction, pendingRoomTurns) }
  const group = createRoomTile(board, materials, room, opposite[direction])
  rooms.push({ ...room, group })
  tile.usedDoors.push(direction)
  const doorMesh = tile.group.children.find((child) => child.userData.doorDirection === direction)
  if (doorMesh) doorMesh.visible = false
  pendingRoomDraw = null
  pendingRoomTurns = 0
  setStatus('Pièce posée. Cliquez dessus pour y entrer.')
  saveGameState()
  renderGameUi()
}

const searchCurrentRoom = () => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId === null || actionsRemaining <= 0) return
  const room = rooms.find((item) => item.id === currentRoomId)
  if (!room) return
  if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Seul le Furtif peut fouiller une pièce piégée.')
    return
  }
  if (room.status === 'locked' && !room.unlocked) {
    if (activeSurvivorKind !== 'heavy') {
      setStatus('Le Costaud doit fouiller cette pièce en premier.')
      return
    }
    room.unlocked = true
  }

  spendAction()
  setStatus('Fouille de la pièce…')
  rollRoomDice(room)
}

const returnToCorridor = () => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId === null || actionsRemaining <= 0) return
  currentTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeRing.position.set(0, 0.183, 0.16)
  currentRoomId = null
  survivorPositions[activeSurvivorKind].roomId = null
  spendAction()
  setStatus('Retour dans le couloir.')
  saveGameState()
  renderGameUi()
}

const enterRoom = (room: RoomTile) => {
  if (phase !== 'actions' || activeSurvivorKind === 'injured' || currentRoomId !== null) return
  if (room.originX !== currentTile.x || room.originZ !== currentTile.z) return
  if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Pièce piégée : seul le Furtif peut y entrer.')
    return
  }

  if (actionsRemaining <= 0) {
    setStatus('Il ne reste plus d’action pour entrer dans une pièce.')
    return
  }
  currentRoomId = room.id
  survivorPositions[activeSurvivorKind] = { x: currentTile.x, z: currentTile.z, roomId: room.id }
  spendAction()
  currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  room.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0)
  activeRing.position.set(0, 0.183, 0)
  selectedCardId = null
  placementPreview = null

  if (room.status === 'locked' && !room.unlocked) {
    setStatus('Vous entrez dans une pièce verrouillée. Déverrouillez-la pour la fouiller.')
  } else if (room.status === 'trapped' && activeSurvivorKind !== 'stealth') {
    setStatus('Vous entrez dans une pièce piégée. Seul le survivant furtif peut la fouiller.')
  } else {
    setStatus(room.searched
      ? 'Vous entrez dans une pièce déjà fouillée. Vous pouvez la fouiller à nouveau.'
      : 'Vous entrez dans la pièce. Fouillez-la quand vous êtes prêt.')
  }
  saveGameState()
  renderGameUi()
}

const renderGameUi = () => {
  survivorCards[activeSurvivorKind] = { deck: corridorDeck, discard: discardPile, hand }
  updatePlacementHighlights()
  if (!handElement) return
  handElement.replaceChildren()
  hand.forEach((card) => {
    const selected = selectedCardId === card.id
    const cardTurns = selected ? selectedCardTurns : 0
    const button = createCorridorHandCard({
      card,
      selected,
      turns: cardTurns,
      disabled: phase !== 'actions' || Boolean(pendingDraw) || activeSurvivorKind === 'injured',
      onSelect: () => {
        if (selectedCardId === card.id) {
          selectedCardId = null
          placementPreview = null
          setStatus('Sélection annulée.')
        } else {
          selectedCardId = card.id
          selectedCardTurns = 0
          placementPreview = null
          const placements = getPlacements(card, selectedCardTurns)
          setStatus(placements.length
            ? 'Choisissez un emplacement lumineux sur le plateau.'
            : 'Aucun emplacement compatible pour cette orientation. Faites pivoter le couloir.')
        }
        renderGameUi()
      },
    })
    handElement.append(button)
  })

  if (deckCountElement) deckCountElement.textContent = String(corridorDeck.length)
  if (discardCountElement) discardCountElement.textContent = String(discardPile.length)
  if (actionsCountElement) actionsCountElement.textContent = String(actionsRemaining)
  if (actionsFillElement) actionsFillElement.style.width = `${(actionsRemaining / 7) * 100}%`
  const personalResources = resourcesBySurvivor[activeSurvivorKind]
  const personalOwnerElement = document.querySelector<HTMLElement>('#personal-resource-owner')
  if (personalOwnerElement) personalOwnerElement.textContent = getSurvivorLabel(activeSurvivorKind)
  for (const resource of Object.keys(personalResources) as ResourceType[]) {
    const element = resourceElements[resource]
    if (element) element.textContent = String(personalResources[resource])
  }
  renderGlobalResourceInventory()

  if (turnLabel) turnLabel.textContent = `TOUR ${String(turnNumber).padStart(2, '0')}`

  const activePlayerTurn = document.querySelector<HTMLElement>('#active-player-turn')
  if (activePlayerTurn) activePlayerTurn.textContent = String(turnNumber)

  const activePlayerName = document.querySelector<HTMLElement>('.active-player-name strong')
  if (activePlayerName) activePlayerName.textContent = getSurvivorLabel(activeSurvivorKind)

  const activePlayerRole = document.querySelector<HTMLElement>('.active-player-name small')
  if (activePlayerRole) {
    activePlayerRole.textContent = activeSurvivorKind === 'injured'
      ? 'DÉPLACEMENT · 1 CC'
      : phase === 'draw'
        ? 'PHASE 1 · PIOCHE'
        : `PHASE 2 · ACTIONS · ${actionsRemaining} RESTANTES`
  }

  const phaseLabel = document.querySelector<HTMLElement>('#phase-label')
  if (phaseLabel) {
    phaseLabel.textContent = activeSurvivorKind === 'injured'
      ? 'Déplacement du Blessé'
      : phase === 'draw'
        ? 'Phase 1 — Compléter la main à 3 CC'
        : 'Phase 2 — Réaliser ses actions'
  }

  const handCount = document.querySelector<HTMLElement>('#cc-hand-count')
  if (handCount) handCount.textContent = `${hand.length} cartes`

  const selectedCard = hand.find((card) => card.id === selectedCardId)
  const hasPreview = Boolean(selectedCard && placementPreview)

  if (placeButton) {
    placeButton.disabled = phase !== 'actions' || !hasPreview || Boolean(pendingDraw) || activeSurvivorKind === 'injured'
    placeButton.textContent = hasPreview ? 'Valider la pose' : 'Choisir un emplacement'
  }

  if (rotateButton) {
    rotateButton.disabled = phase !== 'actions' || selectedCardId === null || Boolean(pendingDraw) || activeSurvivorKind === 'injured'
    rotateButton.textContent = selectedCardId !== null
      ? `Orientation ${['N', 'E', 'S', 'W'][selectedCardTurns]} · ↻`
      : 'Changer l’orientation'
  }

  if (cancelPlacementButton) cancelPlacementButton.disabled = selectedCardId === null
  if (discardButton) discardButton.disabled = !pendingDraw
  if (replaceButton) replaceButton.disabled = !pendingDraw || hand.length === 0
  if (drawButton) {
    const disabled = phase !== 'draw' || hand.length >= 3 || activeSurvivorKind === 'injured'
    drawButton.setAttribute('aria-disabled', String(disabled))
    drawButton.classList.toggle('is-disabled', disabled)
  }
  if (endTurnButton) endTurnButton.disabled = phase !== 'actions' || Boolean(pendingDraw) || Boolean(pendingRoomDraw)

  if (pendingDraw) {
    const note = document.createElement('p')
    note.className = 'pending-draw'
    note.textContent = `Pioche : ${corridorDefinitions[pendingDraw.kind].label}. Choisissez un couloir à remplacer, ou défaussez la carte.`
    handElement.append(note)
  }

  renderRoomControls({
    roomDoorOptionsElement,
    drawRoomButton,
    roomDeckLength: roomDeck.length,
    rooms,
    currentRoomId,
    pendingRoomDraw,
    phase,
    activeSurvivorKind,
    actionsRemaining,
    hasAvailableDoors: getAvailableDoors().length > 0,
    onSearchRoom: searchCurrentRoom,
  })
}
drawRoomButton?.addEventListener('click', (event) => {
  const stack = event.currentTarget
  if (!(stack instanceof HTMLElement) || stack.getAttribute('aria-disabled') === 'true') return
  drawRoomCard()
})
drawRoomButton?.addEventListener('keydown', (event) => {
  const stack = event.currentTarget
  if ((event.key === 'Enter' || event.key === ' ') && stack instanceof HTMLElement && stack.getAttribute('aria-disabled') !== 'true') {
    event.preventDefault()
    drawRoomCard()
  }
})

drawButton?.addEventListener('click', drawCorridorCard)
drawButton?.addEventListener('keydown', (event) => {
  const stack = event.currentTarget
  if ((event.key === 'Enter' || event.key === ' ') && stack instanceof HTMLElement && stack.getAttribute('aria-disabled') !== 'true') {
    event.preventDefault()
    drawCorridorCard()
  }
})
placeButton?.addEventListener('click', confirmPlacement)
const rotateSelectedCorridor = () => {
  if (selectedCardId === null || phase !== 'actions') return
  if (placementPreview && placementPreview.options.length > 0) {
    const nextOptionIndex = (placementPreview.optionIndex + 1) % placementPreview.options.length
    placementPreview.optionIndex = nextOptionIndex
    selectedCardTurns = placementPreview.options[nextOptionIndex].turns
  } else {
    selectedCardTurns = (selectedCardTurns + 1) % 4
  }
  updatePlacementHighlights()
  renderGameUi()
  setStatus(placementPreview
    ? 'Orientation valide modifiée. Vérifiez les passages et validez la pose.'
    : 'Orientation modifiée. Choisissez un emplacement compatible.')
}
rotateRoomPlacementButton?.addEventListener('click', () => {
  if (!pendingRoomDraw) return
  pendingRoomTurns = (pendingRoomTurns + 1) % 4
  if (rotateRoomPlacementButton) rotateRoomPlacementButton.textContent = `↻ CP ${['N', 'E', 'S', 'W'][pendingRoomTurns]}`
  setStatus(`Orientation de la pièce : ${['Nord', 'Est', 'Sud', 'Ouest'][pendingRoomTurns]}.`)
})
rotateButton?.addEventListener('click', rotateSelectedCorridor)
rotateGhostButton?.addEventListener('click', rotateSelectedCorridor)
confirmGhostButton?.addEventListener('click', confirmPlacement)
cancelPlacementButton?.addEventListener('click', () => {
  selectedCardId = null
  placementPreview = null
  clearGhostTile()
  renderGameUi()
  setStatus('Pose annulée. Choisissez un couloir pour continuer.')
})
discardButton?.addEventListener('click', () => {
  if (!pendingDraw) return
  discardPile.push(pendingDraw)
  pendingDraw = null
  setStatus('Carte piochée défaussée.')
  saveGameState()
  renderGameUi()
})
replaceButton?.addEventListener('click', () => {
  if (!pendingDraw || !handElement) return
  setStatus('Choisissez dans votre main le couloir à remplacer par la pioche.')
  handElement.querySelectorAll<HTMLButtonElement>('.cc-card').forEach((button, index) => {
    button.disabled = false
    button.classList.add('is-replaceable')
    button.addEventListener('click', () => {
      const oldCard = hand[index]
      if (!oldCard || !pendingDraw) return
      discardPile.push(oldCard)
      hand[index] = pendingDraw
      pendingDraw = null
      selectedCardId = hand[index].id
      setStatus(`Couloir remplacé. « ${corridorDefinitions[oldCard.kind].label} » défaussé.`)
      saveGameState()
      renderGameUi()
    }, { once: true })
  })
})
endTurnButton?.addEventListener('click', () => {
  if (pendingDraw) {
    setStatus('Décidez d’abord du sort de la carte piochée.')
    return
  }
  if (pendingRoomDraw) {
    setStatus('Posez ou annulez la pièce piochée avant de terminer le tour.')
    return
  }
  characterIndex += 1
  if (characterIndex >= characterOrder.length) {
    characterIndex = 0
    turnNumber += 1
    injuredMovedThisTurn = false
  }
  selectedCardId = null
  placementPreview = null
  activateSurvivor(characterOrder[characterIndex])
  actionsRemaining = activeSurvivorKind === 'injured' ? 1 : 7
  phase = activeSurvivorKind === 'injured' || hand.length >= 3 ? 'actions' : 'draw'
  setStatus(activeSurvivorKind === 'injured'
    ? 'Tour du Blessé : choisissez un couloir adjacent pour le faire avancer d’une seule case.'
    : `Tour de ${getSurvivorLabel(activeSurvivorKind)} : complétez votre main à 3 couloirs avant d’agir.`)
  saveGameState()
  renderGameUi()
})

if (phase === 'draw' && activeSurvivorKind !== 'injured' && hand.length >= 3) phase = 'actions'
renderGameUi()

const resize = () => {
  const width = root.clientWidth
  const height = root.clientHeight
  if (width === 0 || height === 0) return

  const aspect = width / height
  const viewHeight = aspect < 1 ? 13 : 11
  camera.left = (-viewHeight * aspect) / 2
  camera.right = (viewHeight * aspect) / 2
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const roomHoverCard = document.querySelector<HTMLDivElement>('#room-hover-card')

const hideRoomHoverCard = () => {
  if (roomHoverCard) roomHoverCard.hidden = true
}

const showRoomHoverCard = (room: RoomTile, event: PointerEvent) => {
  if (!roomHoverCard) return

  const status = room.status === 'locked'
    ? room.unlocked ? 'Déverrouillée' : 'Verrouillée'
    : room.status === 'trapped' ? 'Piégée' : 'Non verrouillée'
  const statusClass = room.status === 'locked' && !room.unlocked
    ? 'is-locked'
    : room.status === 'trapped' ? 'is-trapped' : 'is-safe'

  const heading = document.createElement('strong')
  heading.className = 'room-hover-title'
  heading.textContent = `Pièce ${String(room.id).padStart(2, '0')}`

  const statusLine = document.createElement('div')
  statusLine.className = `room-hover-status ${statusClass}`
  statusLine.textContent = status

  const difficulty = document.createElement('p')
  difficulty.className = 'room-hover-difficulty'
  difficulty.textContent = `Difficulté ${getDifficultyLabel(room.difficulty).toLowerCase()}`

  const lootHeading = document.createElement('span')
  lootHeading.className = 'room-hover-section'
  lootHeading.textContent = 'Chances de trouver'

  const lootList = document.createElement('div')
  lootList.className = 'room-hover-loot'
  getRoomResourceChances(room.difficulty, activeSurvivorKind).forEach(({ resource, chancePercent }) => {
    const row = document.createElement('div')
    row.className = 'room-hover-loot-row'
    const name = document.createElement('span')
    name.textContent = resourceLabels[resource]
    const chance = document.createElement('strong')
    chance.textContent = `${chancePercent} %`
    row.append(name, chance)
    lootList.append(row)
  })

  roomHoverCard.replaceChildren(heading, statusLine, difficulty, lootHeading, lootList)
  const bounds = roomHoverCard.parentElement?.getBoundingClientRect()
  if (bounds) {
    const left = event.clientX - bounds.left
    const top = event.clientY - bounds.top
    roomHoverCard.style.left = `${Math.max(8, Math.min(left + 18, bounds.width - 252))}px`
    roomHoverCard.style.top = `${Math.max(8, Math.min(top + 18, bounds.height - 206))}px`
  }
  roomHoverCard.hidden = false
}
let zoom = THREE.MathUtils.clamp(savedGameState?.zoom ?? 1, 1, 3.2)
let currentZoom = zoom
renderer.domElement.addEventListener('pointermove', (event) => {
  if (viewport.hasDragged() || phase !== 'actions' || currentRoomId !== null || pendingRoomDraw || selectedCardId !== null) {
    hideRoomHoverCard()
    return
  }

  const hit = resolveBoardHit({
    event,
    canvas: renderer.domElement,
    camera,
    raycaster,
    pointer,
    mode: 'normal',
    roomPlacementHighlights,
    placementHighlights,
    rooms,
    boardTiles,
  })
  if (hit.type === 'room') showRoomHoverCard(hit.room, event)
  else hideRoomHoverCard()
})
renderer.domElement.addEventListener('pointerleave', hideRoomHoverCard)

const cameraTarget = new THREE.Vector3(savedGameState?.cameraTarget.x ?? 0, 0, savedGameState?.cameraTarget.z ?? 0)
const cameraDistance = Math.hypot(13, 13)
const initialCameraAngle = Math.atan2(13, 13)
let cameraAngle = savedGameState?.cameraAngle ?? initialCameraAngle
let targetCameraAngle = cameraAngle
const getCameraOffset = (angle: number) => new THREE.Vector3(
  Math.sin(angle) * cameraDistance,
  16,
  Math.cos(angle) * cameraDistance,
)
const syncCameraPosition = () => {
  camera.position.copy(cameraTarget).add(getCameraOffset(cameraAngle))
  camera.lookAt(cameraTarget)
}
syncCameraPosition()

const saveGameState = () => {
  try {
    const state = {
      tiles: boardTiles
        .filter((tile): tile is BoardTile & { kind: CorridorKind } => tile.kind !== 'start')
        .map(({ x, z, kind, exits, doors, usedDoors }) => ({ x, z, kind, exits, doors, usedDoors })),
      rooms: rooms.map(({ id, status, difficulty, searched, unlocked, x, z, originX, originZ, direction, lastRoll }) => ({
        id, status, difficulty, searched, unlocked, x, z, originX, originZ, direction, lastRoll,
      })),
      currentRoomId,
      resources: resourcesBySurvivor[activeSurvivorKind],
      resourcesBySurvivor,
      roomDeck,
      pendingRoomDraw, 
      survivor: { x: currentTile.x, z: currentTile.z },
      survivors: survivorPositions,
      activeSurvivorKind,
      characterOrder,
      characterIndex,
      injuredMovedThisTurn,
      zoom,
      cameraTarget: { x: cameraTarget.x, z: cameraTarget.z },
      cameraAngle: targetCameraAngle,
      deck: corridorDeck,
      discard: discardPile,
      hand,
      survivorCards: {
        ...survivorCards,
        [activeSurvivorKind]: { deck: corridorDeck, discard: discardPile, hand },
      },
      phase,
      pendingDraw,
      actionsRemaining,
      turnNumber,
      nextCardId: corridorCards.getNextCardId(),
      nextRoomCardId: roomCards.getNextCardId(),
    } satisfies SavedGameState
    const serialized = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, serialized)
    void fetch('/__game-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
    }).catch(() => {
      setStatus('Sauvegarde locale effectuée, mais impossible d’écrire le fichier de partie.')
    })
  } catch {
    setStatus('Impossible de sauvegarder la partie dans ce navigateur.')
  }
}

const viewport = setupBoardViewport({
  element: renderer.domElement,
  camera,
  cameraTarget,
  syncCameraPosition,
  getZoom: () => zoom,
  setZoom: (nextZoom) => { zoom = nextZoom },
  onCameraChange: saveGameState,
})

renderer.domElement.addEventListener('click', (event) => {
  if (viewport.hasDragged()) return
  if (phase === 'draw' && activeSurvivorKind !== 'injured' && !boardEditMode) {
    setStatus('Terminez d’abord la phase de pioche en complétant votre main à 3 couloirs.')
    return
  }

  const mode = boardEditMode
    ? 'normal'
    : pendingRoomDraw
      ? 'room-placement'
    : selectedCardId !== null && !pendingDraw
      ? 'corridor-placement'
      : 'normal'
  const hit = resolveBoardHit({
    event,
    canvas: renderer.domElement,
    camera,
    raycaster,
    pointer,
    mode,
    roomPlacementHighlights,
    placementHighlights,
    rooms,
    boardTiles,
  })

  if (boardEditMode) {
    if (hit.type === 'tile' && hit.tile.kind !== 'start') {
      selectedBoardCard = { type: 'tile', tile: hit.tile }
      if (boardEditActions && boardEditLabel) {
        boardEditLabel.textContent = 'Couloir sélectionné'
        boardEditActions.style.left = `${event.clientX - renderer.domElement.getBoundingClientRect().left + 12}px`
        boardEditActions.style.top = `${event.clientY - renderer.domElement.getBoundingClientRect().top + 12}px`
        boardEditActions.hidden = false
      }
    } else if (hit.type === 'room') {
      selectedBoardCard = { type: 'room', room: hit.room }
      if (boardEditActions && boardEditLabel) {
        boardEditLabel.textContent = 'Pièce sélectionnée'
        boardEditActions.style.left = `${event.clientX - renderer.domElement.getBoundingClientRect().left + 12}px`
        boardEditActions.style.top = `${event.clientY - renderer.domElement.getBoundingClientRect().top + 12}px`
        boardEditActions.hidden = false
      }
    } else {
      selectedBoardCard = null
      if (boardEditActions) boardEditActions.hidden = true
    }
    return
  }

  if (pendingRoomDraw) {
    if (hit.type === 'room-placement') {
      placeDrawnRoom({
        x: hit.x,
        z: hit.z,
        direction: hit.direction,
        originX: hit.originX,
        originZ: hit.originZ,
      })
    } else {
      setStatus('Cliquez sur un emplacement lumineux pour poser la pièce.')
    }
    return
  }

  if (selectedCardId !== null && !pendingDraw) {
    if (hit.type === 'corridor-placement') {
      const card = hand.find((item) => item.id === selectedCardId)
      const candidate = card
        ? getPlacements(card).find((item) => item.x === hit.x && item.z === hit.z)
        : undefined
      if (candidate) {
        const optionIndex = candidate.options.findIndex((option) => option.turns === selectedCardTurns)
        placementPreview = {
          x: hit.x,
          z: hit.z,
          options: candidate.options,
          optionIndex: optionIndex >= 0 ? optionIndex : 0,
        }
        selectedCardTurns = candidate.options[placementPreview.optionIndex].turns
        updatePlacementHighlights()
        renderGameUi()
        setStatus('Couloir pré-positionné. Tournez-le si besoin, puis validez à côté de la carte.')
      }
    } else {
      setStatus('Cliquez sur un emplacement lumineux pour préparer la pose.')
    }
    return
  }

  if (hit.type === 'room') {
    const targetRoom = hit.room
    if (activeSurvivorKind === 'injured') {
      setStatus('Le Blessé ne peut pas entrer dans les pièces.')
    } else if (currentRoomId === targetRoom.id) {
      setStatus('Vous êtes déjà dans cette pièce.')
    } else if (currentRoomId !== null) {
      setStatus('Vous êtes déjà dans une pièce. Revenez dans le couloir avant d’entrer ailleurs.')
    } else if (targetRoom.originX === currentTile.x && targetRoom.originZ === currentTile.z) {
      enterRoom(targetRoom)
    } else {
      setStatus('Cette pièce n’est pas accessible depuis votre position actuelle.')
    }
    return
  }

  if (hit.type !== 'tile') {
    root.dataset.selected = 'unknown'
    return
  }
  const targetTile = hit.tile

  if (currentRoomId !== null) {
    if (targetTile === currentTile) {
      returnToCorridor()
      return
    }
    setStatus('Vous êtes dans une pièce. Revenez d’abord dans le couloir.')
    return
  }

  if (targetTile === currentTile) {
    root.dataset.selected = 'current-tile'
    setStatus('Le survivant est déjà sur cette case.')
    return
  }

  const decision = evaluateCorridorMove({
    from: currentTile,
    to: targetTile,
    actionsRemaining,
    survivorKind: activeSurvivorKind,
    injuredMovedThisTurn,
  })

  if (!decision.allowed) {
    switch (decision.reason) {
      case 'injured-limit':
        setStatus('Le Blessé ne peut avancer que d’un seul couloir par tour.')
        return
      case 'not-adjacent':
        root.dataset.selected = 'not-adjacent'
        setStatus('Déplacement impossible : choisissez une case adjacente.')
        return
      case 'no-actions':
        setStatus('Il ne reste plus d’action pour se déplacer.')
        return
      case 'blocked':
        root.dataset.selected = 'blocked'
        setStatus('Passage bloqué : les deux cases ne sont pas reliées par une sortie.')
        return
    }
  }

  currentTile.group.remove(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  targetTile.group.add(activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeRing.position.set(0, 0.183, 0.16)
  currentTile = targetTile
  survivorPositions[activeSurvivorKind] = { x: currentTile.x, z: currentTile.z, roomId: null }
  if (activeSurvivorKind === 'injured') injuredMovedThisTurn = true
  spendAction()
  root.dataset.selected = 'current-tile'
  setStatus(`Déplacement effectué. ${actionsRemaining} action${actionsRemaining > 1 ? 's' : ''} restante${actionsRemaining > 1 ? 's' : ''}.`)
  saveGameState()
  renderGameUi()
})


editModeButton?.addEventListener('click', () => {
  boardEditMode = !boardEditMode
  selectedBoardCard = null
  if (boardEditActions) boardEditActions.hidden = true
  if (editModeButton) {
    editModeButton.setAttribute('aria-pressed', String(boardEditMode))
    editModeButton.textContent = boardEditMode ? 'Quitter édition' : 'Éditer'
  }
  selectedCardId = null
  placementPreview = null
  pendingRoomDraw = null
  clearGhostTile()
  renderGameUi()
  setStatus(boardEditMode ? 'Mode édition : sélectionnez une carte du plateau.' : 'Mode édition désactivé.')
})
closeBoardEditButton?.addEventListener('click', () => {
  selectedBoardCard = null
  if (boardEditActions) boardEditActions.hidden = true
})
rotateBoardCardButton?.addEventListener('click', () => {
  if (!selectedBoardCard) return
  const turns = 1
  if (selectedBoardCard.type === 'tile') {
    const tile = selectedBoardCard.tile
    tile.exits = tile.exits.map((direction) => rotateDirection(direction, turns))
    tile.doors = tile.doors.map((direction) => rotateDirection(direction, turns))
    tile.usedDoors = tile.usedDoors.map((direction) => rotateDirection(direction, turns))
  } else {
    const room = selectedBoardCard.room
    room.direction = rotateDirection(room.direction, turns)
  }
  saveGameState()
  setStatus('Orientation de la carte modifiée.')
})

document.querySelector<HTMLButtonElement>('#reset-game')?.addEventListener('click', () => {
  const confirmed = window.confirm('Réinitialiser la partie ? Le plateau actuel sera perdu.')
  if (!confirmed) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } finally {
    window.location.reload()
  }
})

document.querySelector<HTMLButtonElement>('#rotate-left')?.addEventListener('click', () => {
  targetCameraAngle -= Math.PI / 2
  saveGameState()
})

document.querySelector<HTMLButtonElement>('#rotate-right')?.addEventListener('click', () => {
  targetCameraAngle += Math.PI / 2
  saveGameState()
})

const clock = new THREE.Clock()
const animate = () => {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const elapsed = clock.elapsedTime
  cameraAngle = THREE.MathUtils.damp(cameraAngle, targetCameraAngle, 5, delta)
  const cameraOffset = getCameraOffset(cameraAngle)
  camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraTarget.x + cameraOffset.x, 8, delta)
  camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraTarget.y + cameraOffset.y, 8, delta)
  camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraTarget.z + cameraOffset.z, 8, delta)
  camera.lookAt(cameraTarget)
  currentZoom = THREE.MathUtils.damp(currentZoom, zoom, 4, delta)
  camera.zoom = currentZoom
  camera.updateProjectionMatrix()
  beacon.scale.y = 1 + Math.sin(elapsed * 2.2) * 0.07
  if (placementActions && !placementActions.hidden && placementPreview) {
    camera.updateMatrixWorld()
    const projected = new THREE.Vector3(placementPreview.x * 1.18, 1.1, placementPreview.z * 1.18).project(camera)
    const sceneBounds = root.parentElement?.getBoundingClientRect()
    if (sceneBounds) {
      const canvasBounds = renderer.domElement.getBoundingClientRect()
      const left = (projected.x * 0.5 + 0.5) * canvasBounds.width + canvasBounds.left - sceneBounds.left
      const top = (-projected.y * 0.5 + 0.5) * canvasBounds.height + canvasBounds.top - sceneBounds.top
      placementActions.style.left = `${left + 34}px`
      placementActions.style.top = `${top - 18}px`
    }
  }
  renderer.render(scene, camera)
}

const observer = new ResizeObserver(resize)
observer.observe(root)
resize()
animate()

window.addEventListener('beforeunload', () => {
  observer.disconnect()
  renderer.dispose()
})
