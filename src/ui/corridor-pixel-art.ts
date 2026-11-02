import { addCorridorDoorPixels, rotateCorridorPixels, getCorridorPixelTemplateId, getCorridorPixelTemplate, getCorridorPixelSize, getCorridorPixelRotation } from '../game/corridor-pixel-templates'
import { corridorDefinitions, rotateDirection } from '../game/directions'
import type { CorridorCard } from '../game/types'

export const createCorridorPixelArt = (card: CorridorCard, turns: number): HTMLSpanElement => {
  const doors = card.doors.length
  const id = getCorridorPixelTemplateId(card.kind, 0)
  const source = getCorridorPixelTemplate(id)
  const size = getCorridorPixelSize(source)
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const rotation = getCorridorPixelRotation(card.kind, exits)
  const rotated = rotateCorridorPixels(source, rotation)
  const pixels = addCorridorDoorPixels(rotated, card.doors.map((direction) => rotateDirection(direction, turns)))
  const image = document.createElement('span')
  image.className = 'cc-pixel-art'
  image.setAttribute('role', 'img')
  image.setAttribute('aria-label', `Couloir ${card.kind}, ${doors} porte(s)`)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.imageRendering = 'pixelated'
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
