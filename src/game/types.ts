import type * as THREE from 'three'

export type SurvivorKind = 'stealth' | 'heavy' | 'military' | 'scientist' | 'injured'
export type CorridorKind = 'straight' | 'left' | 'right' | 'tee' | 'cross'
export type Direction = 'N' | 'E' | 'S' | 'W'
export type CorridorCard = { id: number; kind: CorridorKind; doors: Direction[] }
export type RoomStatus = 'ordinary' | 'locked' | 'trapped'
export type RoomDifficulty = 'easy' | 'medium' | 'hard'
export type ResourceType = 'cafe' | 'croissant' | 'citron' | 'bonbon' | 'munition'
export type RoomRollResult = { resource: ResourceType; value: number; threshold: number; found: boolean }
export type RoomCard = { id: number; status: RoomStatus; difficulty: RoomDifficulty; searched: boolean; unlocked: boolean }
export type SavedRoom = RoomCard & { x: number; z: number; originX: number; originZ: number; direction: Direction; lastRoll?: RoomRollResult[] }
export type RoomTile = SavedRoom & { group: THREE.Group }
export type BoardTile = { x: number; z: number; kind: CorridorKind | 'start'; exits: Direction[]; doors: Direction[]; usedDoors: Direction[]; group: THREE.Group }
export type PlacementOption = { exits: Direction[]; turns: number }
export type PlacementCandidate = { x: number; z: number; options: PlacementOption[] }
export type SurvivorCards = { deck: CorridorCard[]; discard: CorridorCard[]; hand: CorridorCard[] }

export type SavedGameState = {
  tiles: Array<{ x: number; z: number; kind: CorridorKind; exits: Direction[]; doors?: Direction[]; usedDoors?: Direction[] }>
  rooms?: SavedRoom[]
  currentRoomId?: number | null
  resources?: Record<ResourceType, number>
  roomDeck?: RoomCard[]
  pendingRoomDraw?: RoomCard | null
  nextRoomCardId?: number
  survivor: { x: number; z: number }
  survivors?: Partial<Record<SurvivorKind, { x: number; z: number; roomId: number | null }>>
  activeSurvivorKind?: SurvivorKind
  characterOrder?: SurvivorKind[]
  characterIndex?: number
  injuredMovedThisTurn?: boolean
  phase?: 'draw' | 'actions'
  survivorCards?: Partial<Record<SurvivorKind, SurvivorCards>>
  zoom: number
  cameraTarget: { x: number; z: number }
  cameraAngle?: number
  deck: CorridorCard[]
  discard: CorridorCard[]
  hand: CorridorCard[]
  pendingDraw: CorridorCard | null
  actionsRemaining: number
  turnNumber: number
  nextCardId: number
}
