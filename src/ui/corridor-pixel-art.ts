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
  image.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`
  image.style.gridTemplateRows = `repeat(${size}, minmax(0, 1fr))`
  image.innerHTML = pixels.map((color, index) =>
    `<span class="cc-pixel" style="--x:${index % size};--y:${Math.floor(index / size)};--pixel-color:${color}"></span>`,
  ).join('')
  return image
}
