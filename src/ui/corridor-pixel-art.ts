import { rotateCorridorPixels, getCorridorPixelTemplateId, getCorridorPixelTemplate, CORRIDOR_PIXEL_SIZE } from '../game/corridor-pixel-templates'
import type { CorridorCard } from '../game/types'

export const createCorridorPixelArt = (card: CorridorCard, turns: number): HTMLSpanElement => {
  const doors = card.doors.length
  const id = getCorridorPixelTemplateId(card.kind, doors)
  const pixels = rotateCorridorPixels(getCorridorPixelTemplate(id), turns)
  const image = document.createElement('span')
  image.className = 'cc-pixel-art'
  image.setAttribute('role', 'img')
  image.setAttribute('aria-label', `Couloir ${card.kind}, ${doors} porte(s)`)
  image.style.gridTemplateColumns = `repeat(${CORRIDOR_PIXEL_SIZE}, minmax(0, 1fr))`
  image.style.gridTemplateRows = `repeat(${CORRIDOR_PIXEL_SIZE}, minmax(0, 1fr))`
  image.innerHTML = pixels.map((color, index) =>
    `<span class="cc-pixel" style="--x:${index % CORRIDOR_PIXEL_SIZE};--y:${Math.floor(index / CORRIDOR_PIXEL_SIZE)};--pixel-color:${color}"></span>`,
  ).join('')
  return image
}
