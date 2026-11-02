import * as THREE from 'three'
import { directionOrder, opposite } from '../game/directions'
import type { Direction } from '../game/types'
import { roomPixelTemplate, ROOM_PIXEL_SIZE } from '../game/room-pixel-template'

const rotatePixels = (source: string[], turns: number): string[] => {
  let output = [...source]
  for (let turn = 0; turn < turns; turn += 1) {
    const rotated = Array(ROOM_PIXEL_SIZE ** 2).fill('#171d20')
    for (let y = 0; y < ROOM_PIXEL_SIZE; y += 1) {
      for (let x = 0; x < ROOM_PIXEL_SIZE; x += 1) {
        rotated[x * ROOM_PIXEL_SIZE + (ROOM_PIXEL_SIZE - 1 - y)] =
          output[y * ROOM_PIXEL_SIZE + x]
      }
    }
    output = rotated
  }
  return output
}

export const createRoomCardTexture = (roomDirection: Direction): THREE.CanvasTexture => {
  // The source artwork has its door on the south edge. Rotate it toward the
  // corridor from which this room was placed.
  const doorDirection = opposite[roomDirection]
  const turns = (directionOrder.indexOf(doorDirection) - directionOrder.indexOf('S') + 4) % 4
  const pixels = rotatePixels(roomPixelTemplate, turns)
  const canvas = document.createElement('canvas')
  canvas.width = ROOM_PIXEL_SIZE
  canvas.height = ROOM_PIXEL_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create room card texture')

  const imageData = context.createImageData(ROOM_PIXEL_SIZE, ROOM_PIXEL_SIZE)
  pixels.forEach((color, index) => {
    const value = Number.parseInt(color.slice(1), 16)
    const offset = index * 4
    imageData.data[offset] = (value >> 16) & 255
    imageData.data[offset + 1] = (value >> 8) & 255
    imageData.data[offset + 2] = value & 255
    imageData.data[offset + 3] = 255
  })
  context.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  return texture
}
