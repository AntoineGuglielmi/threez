import type { CorridorKind, Direction } from './types'

export const directionOrder: Direction[] = ['N', 'E', 'S', 'W']

export const corridorDefinitions: Record<CorridorKind, { label: string; symbol: string; exits: Direction[] }> = {
  straight: { label: 'Droit', symbol: '│', exits: ['N', 'S'] },
  left: { label: 'Virage gauche', symbol: '└', exits: ['N', 'W'] },
  right: { label: 'Virage droite', symbol: '┘', exits: ['N', 'E'] },
  tee: { label: 'Carrefour en T', symbol: '┬', exits: ['N', 'E', 'W'] },
  cross: { label: 'Carrefour en croix', symbol: '┼', exits: ['N', 'E', 'S', 'W'] },
}

export const directionDelta: Record<Direction, [number, number]> = {
  N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0],
}

export const opposite: Record<Direction, Direction> = { N: 'S', E: 'W', S: 'N', W: 'E' }

export const rotateDirection = (direction: Direction, turns: number): Direction =>
  directionOrder[(directionOrder.indexOf(direction) + turns + 4) % 4]
