import type { CorridorKind } from './types'

export const CORRIDOR_PIXEL_SIZE = 32
export const CORRIDOR_PIXEL_STORAGE_KEY = 'threez:corridor-pixel-templates:v1'
export const CORRIDOR_PIXEL_MODELS = [
  { id: 'straight-0', kind: 'straight', label: 'Couloir droit', doors: 0 },
  { id: 'straight-1', kind: 'straight', label: 'Couloir droit', doors: 1 },
  { id: 'straight-2', kind: 'straight', label: 'Couloir droit', doors: 2 },
  { id: 'turn-0', kind: 'turn', label: 'Virage', doors: 0 },
  { id: 'turn-1', kind: 'turn', label: 'Virage', doors: 1 },
  { id: 'turn-2', kind: 'turn', label: 'Virage', doors: 2 },
  { id: 'tee-0', kind: 'tee', label: 'Couloir en T', doors: 0 },
  { id: 'tee-1', kind: 'tee', label: 'Couloir en T', doors: 1 },
  { id: 'cross-0', kind: 'cross', label: 'Carrefour en X', doors: 0 },
] as const
export type CorridorPixelTemplateId = typeof CORRIDOR_PIXEL_MODELS[number]['id']
export type CorridorPixelTemplates = Partial<Record<CorridorPixelTemplateId, string[]>>

export const getCorridorPixelTemplateId = (kind: CorridorKind, doors: number): CorridorPixelTemplateId => {
  const shape = kind === 'left' || kind === 'right' ? 'turn' : kind
  const count = shape === 'tee' ? Math.min(doors, 1) : shape === 'cross' ? 0 : Math.min(doors, 2)
  return `${shape}-${count}` as CorridorPixelTemplateId
}

export const createDefaultCorridorPixels = (id: CorridorPixelTemplateId): string[] => {
  const pixels = Array(CORRIDOR_PIXEL_SIZE ** 2).fill('#171d20')
  const paintRect = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    for (let y = y1; y <= y2; y += 1) for (let x = x1; x <= x2; x += 1) pixels[y * CORRIDOR_PIXEL_SIZE + x] = color
  }
  const [shape, doorCount] = id.split('-')
  const floor = '#626b6d'
  const wall = '#a4a99e'
  const door = '#76513d'
  // Simple top-down floor-plan starter templates; every pixel can be repainted.
  paintRect(10, 10, 21, 21, floor)
  if (shape === 'straight' || shape === 'tee' || shape === 'cross') paintRect(13, 0, 18, 31, floor)
  if (shape === 'turn') { paintRect(0, 13, 18, 18, floor); paintRect(13, 13, 18, 31, floor) }
  if (shape === 'tee' || shape === 'cross') paintRect(0, 13, 31, 18, floor)
  if (shape === 'cross') paintRect(13, 0, 18, 31, floor)
  // Wall pixels around the walkable footprint.
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    if (pixels[y * 32 + x] !== floor) continue
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < 32 && ny >= 0 && ny < 32 && pixels[ny * 32 + nx] === '#171d20') pixels[ny * 32 + nx] = wall
    }
  }
  // Door accents on non-exit wall edges; editable like every other pixel.
  if (Number(doorCount) > 0) paintRect(8, 10, 9, 12, door)
  if (Number(doorCount) > 1) paintRect(22, 19, 23, 21, door)
  return pixels
}

export const readCorridorPixelTemplates = (): CorridorPixelTemplates => {
  try {
    const raw = localStorage.getItem(CORRIDOR_PIXEL_STORAGE_KEY)
    return raw ? JSON.parse(raw) as CorridorPixelTemplates : {}
  } catch { return {} }
}

export const rotateCorridorPixels = (source: string[], turns: number): string[] => {
  const size = CORRIDOR_PIXEL_SIZE
  const output = [...source]
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn += 1) {
    const rotated = Array(size * size).fill('#171d20')
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      rotated[x * size + (size - 1 - y)] = output[y * size + x]
    }
    output.splice(0, output.length, ...rotated)
  }
  return output
}
