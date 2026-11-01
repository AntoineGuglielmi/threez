import * as THREE from 'three'
import { roomPixelTemplate, ROOM_PIXEL_SIZE } from '../game/room-pixel-template'

export const createRoomCardTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = ROOM_PIXEL_SIZE
  canvas.height = ROOM_PIXEL_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create room card texture')

  const imageData = context.createImageData(ROOM_PIXEL_SIZE, ROOM_PIXEL_SIZE)
  roomPixelTemplate.forEach((color, index) => {
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
