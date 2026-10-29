import { directionDelta, directionOrder, opposite } from './directions'
import type { BoardTile, Direction, SurvivorKind } from './types'

type CorridorPosition = Pick<BoardTile, 'x' | 'z' | 'exits'>

type CorridorMoveInput = {
  from: CorridorPosition
  to: CorridorPosition
  actionsRemaining: number
  survivorKind: SurvivorKind
  injuredMovedThisTurn: boolean
}

export type CorridorMoveDecision =
  | { allowed: true; direction: Direction }
  | { allowed: false; reason: 'not-adjacent' | 'injured-limit' | 'no-actions' | 'blocked' }

/**
 * Validates a survivor's move between two corridor tiles without mutating game state.
 * The caller remains responsible for applying the move and spending the action.
 */
export const evaluateCorridorMove = ({
  from,
  to,
  actionsRemaining,
  survivorKind,
  injuredMovedThisTurn,
}: CorridorMoveInput): CorridorMoveDecision => {
  if (survivorKind === 'injured' && injuredMovedThisTurn) {
    return { allowed: false, reason: 'injured-limit' }
  }

  const dx = to.x - from.x
  const dz = to.z - from.z
  const direction = directionOrder.find((candidate) => {
    const [x, z] = directionDelta[candidate]
    return x === dx && z === dz
  })

  if (!direction || Math.abs(dx) + Math.abs(dz) !== 1) {
    return { allowed: false, reason: 'not-adjacent' }
  }

  if (actionsRemaining <= 0) {
    return { allowed: false, reason: 'no-actions' }
  }

  if (!from.exits.includes(direction) || !to.exits.includes(opposite[direction])) {
    return { allowed: false, reason: 'blocked' }
  }

  return { allowed: true, direction }
}
