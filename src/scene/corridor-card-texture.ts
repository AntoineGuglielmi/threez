import * as THREE from 'three'
import { addCorridorDoorPixels, getCorridorPixelTemplate, getCorridorPixelTemplateId, getCorridorPixelRotation, rotateCorridorPixels, getCorridorPixelSize } from '../game/corridor-pixel-templates'
import type { CorridorKind, Direction } from '../game/types'

export const createCorridorCardTexture = (
  kind: CorridorKind,
  doors: Direction[],
  exits: Direction[],
): THREE.CanvasTexture => {
  const templateId = getCorridorPixelTemplateId(kind, 0)
  const source = getCorridorPixelTemplate(templateId)
  const turns = getCorridorPixelRotation(kind, exits)
  const rotated = rotateCorridorPixels(source, turns)
  const pixels = addCorridorDoorPixels(rotated, doors)
  const size = getCorridorPixelSize(pixels)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create corridor card texture')

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

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  return texture
}

export const createDefaultCorridorCardTexture = (): THREE.CanvasTexture =>
  createCorridorCardTexture('straight', [], ['N', 'S'])
