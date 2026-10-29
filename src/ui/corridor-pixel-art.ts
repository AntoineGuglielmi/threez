import { corridorDefinitions, directionOrder, rotateDirection } from '../game/directions'
import type { CorridorCard, Direction } from '../game/types'

type Pixel = { x: number; y: number; color: string }

const palette = {
  void: '#151b1e',
  floor: '#596267',
  floorLight: '#737b7e',
  floorDark: '#414b50',
  grout: '#343e43',
  wall: '#a0a19a',
  wallLight: '#c0bfb2',
  wallShadow: '#555c5d',
  doorFrame: '#d0b18a',
  door: '#76513d',
  doorLight: '#a87550',
  paper: '#d4c9a9',
  paperShadow: '#887f6d',
  blood: '#783d3b',
  bloodLight: '#a64c47',
  debris: '#30383b',
  metal: '#89969a',
} as const

const SIZE = 32
const FLOOR_START = 11
const FLOOR_END = 21
const CENTER = 16

const isFloor = (x: number, y: number, exits: Direction[]): boolean => {
  const inCenter = x >= FLOOR_START && x < FLOOR_END && y >= FLOOR_START && y < FLOOR_END
  const inNorth = exits.includes('N') && x >= 12 && x < 20 && y < FLOOR_START
  const inSouth = exits.includes('S') && x >= 12 && x < 20 && y >= FLOOR_END
  const inWest = exits.includes('W') && y >= 12 && y < 20 && x < FLOOR_START
  const inEast = exits.includes('E') && y >= 12 && y < 20 && x >= FLOOR_END
  return inCenter || inNorth || inSouth || inWest || inEast
}

const setPixel = (pixels: Map<string, string>, x: number, y: number, color: string) => {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) pixels.set(`${x},${y}`, color)
}

const line = (pixels: Map<string, string>, x1: number, y1: number, x2: number, y2: number, color: string) => {
  const dx = Math.sign(x2 - x1)
  const dy = Math.sign(y2 - y1)
  let x = x1
  let y = y1
  while (true) {
    setPixel(pixels, x, y, color)
    if (x === x2 && y === y2) break
    x += dx
    y += dy
  }
}

const addDoor = (pixels: Map<string, string>, direction: Direction) => {
  const horizontal = direction === 'N' || direction === 'S'
  const start = 13
  const end = 19
  const fixed = direction === 'N' ? 1 : direction === 'S' ? 30 : direction === 'W' ? 1 : 30
  for (let i = start; i <= end; i++) {
    const x = horizontal ? i : fixed
    const y = horizontal ? fixed : i
    setPixel(pixels, x, y, palette.doorFrame)
    setPixel(pixels, x, y + (direction === 'N' ? 1 : direction === 'S' ? -1 : 0), palette.door)
  }
  if (horizontal) {
    line(pixels, 14, fixed, 18, fixed, palette.doorLight)
    setPixel(pixels, 17, fixed + (direction === 'N' ? 1 : -1), palette.metal)
  } else {
    line(pixels, fixed, 14, fixed, 18, palette.doorLight)
    setPixel(pixels, fixed + (direction === 'W' ? 1 : -1), 17, palette.metal)
  }
}

const addWall = (pixels: Map<string, string>, direction: Direction) => {
  if (direction === 'N' || direction === 'S') {
    const y = direction === 'N' ? 0 : 31
    for (let x = 11; x <= 20; x++) {
      setPixel(pixels, x, y, palette.wallShadow)
      setPixel(pixels, x, direction === 'N' ? 1 : 30, palette.wall)
      if (x > 11 && x < 20) setPixel(pixels, x, direction === 'N' ? 2 : 29, palette.wallLight)
    }
  } else {
    const x = direction === 'W' ? 0 : 31
    for (let y = 11; y <= 20; y++) {
      setPixel(pixels, x, y, palette.wallShadow)
      setPixel(pixels, direction === 'W' ? 1 : 30, y, palette.wall)
      if (y > 11 && y < 20) setPixel(pixels, direction === 'W' ? 2 : 29, y, palette.wallLight)
    }
  }
}

const addFloorDetails = (pixels: Map<string, string>) => {
  // Large floor slabs and subtle grout lines.
  for (const x of [7, 15, 23]) {
    for (let y = 3; y < 29; y++) {
      if (pixels.has(`${x},${y}`)) setPixel(pixels, x, y, palette.grout)
    }
  }
  for (const y of [7, 15, 23]) {
    for (let x = 3; x < 29; x++) {
      if (pixels.has(`${x},${y}`)) setPixel(pixels, x, y, palette.grout)
    }
  }

  // Scuffed tiles, a torn paper scrap, blood drops and small debris.
  ;[[14, 11], [15, 11], [16, 11], [14, 12]].forEach(([x, y]) => setPixel(pixels, x, y, palette.floorLight))
  ;[[7, 17], [8, 17], [8, 18], [9, 18]].forEach(([x, y]) => setPixel(pixels, x, y, palette.blood))
  ;[[8, 17], [9, 18]].forEach(([x, y]) => setPixel(pixels, x, y, palette.bloodLight))
  ;[[23, 22], [24, 22], [23, 23], [22, 23]].forEach(([x, y]) => setPixel(pixels, x, y, palette.paper))
  setPixel(pixels, 24, 23, palette.paperShadow)
  ;[[6, 12], [7, 12], [25, 17], [26, 17], [19, 25]].forEach(([x, y]) => setPixel(pixels, x, y, palette.debris))
}

const buildPixels = (card: CorridorCard, turns: number): Pixel[] => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !exits.includes(direction))
  const pixels = new Map<string, string>()

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (isFloor(x, y, exits)) {
        const variation = (Math.floor(x / 4) + Math.floor(y / 4)) % 3
        setPixel(pixels, x, y, variation === 0 ? palette.floorLight : variation === 1 ? palette.floor : palette.floorDark)
      }
    }
  }

  addFloorDetails(pixels)

  // The corridor's closed ends are walls; door openings replace a section of wall.
  directionOrder
    .filter((direction) => !exits.includes(direction) && !doors.includes(direction))
    .forEach((direction) => addWall(pixels, direction))
  doors.forEach((direction) => addDoor(pixels, direction))

  return [...pixels].map(([key, color]) => {
    const [x, y] = key.split(',').map(Number)
    return { x, y, color }
  })
}

export const createCorridorPixelArt = (card: CorridorCard, turns: number): HTMLSpanElement => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !exits.includes(direction))
  const image = document.createElement('span')
  image.className = 'cc-pixel-art'
  image.setAttribute('role', 'img')
  image.setAttribute('aria-label', `Couloir ${card.kind}, ${doors.length} porte(s)`)
  image.style.setProperty('--pixel-size', String(SIZE))
  image.innerHTML = buildPixels(card, turns)
    .map(({ x, y, color }) => `<span class="cc-pixel" style="--x:${x};--y:${y};--pixel-color:${color}"></span>`)
    .join('')
  return image
}
