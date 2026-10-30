import { rotateCorridorPixels, getCorridorPixelTemplateId, getCorridorPixelTemplate, getCorridorPixelSize } from '../game/corridor-pixel-templates'
import type { CorridorCard } from '../game/types'

export const createCorridorPixelArt = (card: CorridorCard, turns: number): HTMLSpanElement => {
  const doors = card.doors.length
  const id = getCorridorPixelTemplateId(card.kind, doors)
  const source = getCorridorPixelTemplate(id)
  const size = getCorridorPixelSize(source)
  const pixels = rotateCorridorPixels(source, turns)
  const image = document.createElement('span')
  image.className = 'cc-pixel-art'
  image.setAttribute('role', 'img')
  image.setAttribute('aria-label', `Couloir ${card.kind}, ${doors} porte(s)`)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.setAttribute('aria-hidden', 'true')
  const context = canvas.getContext('2d')
  if (!context) return image

  const imageData = context.createImageData(size, size)
  pixels.forEach((color, index) => {
    const value = Number.parseInt(color.slice(1), 16)
    const offset = index * 4
    imageData.data[offset] = (value >> 16) & 255
    imageData.data[offset + 1] = (value >> 8) & 255
    imageData.data[offset + 2] = value & 255
    imageData.data[offset + 3] = 255
  })
  context.putImageData(imageData, 0, 0)
  image.append(canvas)
  return image
}
