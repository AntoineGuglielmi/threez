import type { CorridorKind } from './types'

export const CORRIDOR_PIXEL_SIZE = 512
export const getCorridorPixelSize = (pixels: string[]): number => Math.sqrt(pixels.length)
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
export type CorridorPixelTemplates = Record<CorridorPixelTemplateId, string[]>

export const getCorridorPixelTemplateId = (kind: CorridorKind, doors: number): CorridorPixelTemplateId => {
  const shape = kind === 'left' || kind === 'right' ? 'turn' : kind
  const count = shape === 'tee' ? Math.min(doors, 1) : shape === 'cross' ? 0 : Math.min(doors, 2)
  return `${shape}-${count}` as CorridorPixelTemplateId
}

export const rotateCorridorPixels = (source: string[], turns: number): string[] => {
  const size = getCorridorPixelSize(source)
  let output = [...source]
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn += 1) {
    const rotated = Array(size * size).fill('#171d20')
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      rotated[x * size + (size - 1 - y)] = output[y * size + x]
    }
    output = rotated
  }
  return output
}

type CompactModel = { size: number; fill: string } | { size: number; palette: string[]; rows: string[] }
const decodeModel = (model: unknown): string[] => {
  if (Array.isArray(model)) return model as string[]
  if (!model || typeof model !== 'object') throw new Error('Invalid corridor model')
  const data = model as CompactModel
  if ('fill' in data) return Array(data.size ** 2).fill(data.fill)
  return data.rows.join('').split('').map((index) => data.palette[Number.parseInt(index, 36)])
}

const modelFiles = import.meta.glob<Record<string, unknown>>('../../references/models/*.json', {
  eager: true,
  import: 'default',
})
export const corridorPixelTemplates = Object.fromEntries(
  Object.entries(modelFiles).map(([path, data]) => [path.split('/').pop()!.replace('.json', ''), decodeModel(Object.values(data)[0])]),
) as Partial<CorridorPixelTemplates>
export const getCorridorPixelTemplate = (id: CorridorPixelTemplateId): string[] =>
  corridorPixelTemplates[id] ?? Array(CORRIDOR_PIXEL_SIZE ** 2).fill('#171d20')
