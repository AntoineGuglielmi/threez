import { CORRIDOR_PIXEL_CONFIG } from './corridor-pixel-config'

type CompactModel = { size: number; fill: string } | { size: number; palette: string[]; rows: string[] }

const decodeModel = (model: unknown): string[] => {
  if (Array.isArray(model)) return model as string[]
  if (!model || typeof model !== 'object') throw new Error('Invalid room model')
  const data = model as CompactModel
  if ('fill' in data) return Array(data.size ** 2).fill(data.fill)
  const encoded = data.rows.join('')
  const step = encoded.length === data.size ** 2 ? 1 : 2
  return Array.from({ length: data.size ** 2 }, (_, index) =>
    data.palette[Number.parseInt(encoded.slice(index * step, (index + 1) * step), 36)],
  )
}

const modelFiles = import.meta.glob<Record<string, unknown>>('../../references/models/room-*.json', {
  eager: true,
  import: 'default',
})

const roomModel = Object.values(modelFiles)[0]
export const ROOM_PIXEL_SIZE = CORRIDOR_PIXEL_CONFIG.size
export const roomPixelTemplate = roomModel
  ? decodeModel(Object.values(roomModel)[0])
  : Array(ROOM_PIXEL_SIZE ** 2).fill(CORRIDOR_PIXEL_CONFIG.background)
