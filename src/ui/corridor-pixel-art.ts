import { corridorDefinitions, rotateDirection } from '../game/directions'
import { getCorridorPixelTemplateId, readCorridorPixelTemplates, rotateCorridorPixels, CORRIDOR_PIXEL_SIZE } from '../game/corridor-pixel-templates'
import type { CorridorCard } from '../game/types'

export const createCorridorPixelArt = (card: CorridorCard, turns: number): HTMLSpanElement => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors.map((direction) => rotateDirection(direction, turns)).filter((direction) => !exits.includes(direction))
  const image = document.createElement('span')
  image.className = 'cc-pixel-art'
  image.setAttribute('role', 'img')
  image.setAttribute('aria-label', `Couloir ${card.kind}, ${doors.length} porte(s)`)
  const templates = readCorridorPixelTemplates()
  const id = getCorridorPixelTemplateId(card.kind, card.doors.length)
  const pixels = templates[id]
  if (pixels?.length === CORRIDOR_PIXEL_SIZE ** 2) {
    const oriented = rotateCorridorPixels(pixels, turns)
    image.style.gridTemplateColumns = `repeat(${CORRIDOR_PIXEL_SIZE}, minmax(0, 1fr))`
    image.style.gridTemplateRows = `repeat(${CORRIDOR_PIXEL_SIZE}, minmax(0, 1fr))`
    image.innerHTML = oriented.map((color, index) =>
      `<span class="cc-pixel" style="--x:${index % CORRIDOR_PIXEL_SIZE};--y:${Math.floor(index / CORRIDOR_PIXEL_SIZE)};--pixel-color:${color}"></span>`,
    ).join('')
  }
  return image
}
