import { corridorDefinitions, directionOrder, rotateDirection } from '../game/directions'
import type { CorridorCard, Direction } from '../game/types'

type Pixel = { x: number; y: number; color: string }

const palette = {
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

const SIZE = 64
// A wide central hall and broad arms leave substantially more room for floor details.
const FLOOR_START = 22
const FLOOR_END = 42
const ARM_START = 24
const ARM_END = 40
const WALL_START = 22
const WALL_END = 41

const isFloor = (x: number, y: number, exits: Direction[]): boolean => {
  const inCenter = x >= FLOOR_START && x <= FLOOR_END && y >= FLOOR_START && y <= FLOOR_END
  const inNorth = exits.includes('N') && x >= ARM_START && x <= ARM_END && y < FLOOR_START
  const inSouth = exits.includes('S') && x >= ARM_START && x <= ARM_END && y > FLOOR_END
  const inWest = exits.includes('W') && y >= ARM_START && y <= ARM_END && x < FLOOR_START
  const inEast = exits.includes('E') && y >= ARM_START && y <= ARM_END && x > FLOOR_END
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
  const start = 27
  const end = 37
  const fixed = direction === 'N' ? 21 : direction === 'S' ? 42 : direction === 'W' ? 21 : 42
  const inward = direction === 'N' || direction === 'W' ? 1 : -1

  for (let i = start; i <= end; i++) {
    const x = horizontal ? i : fixed
    const y = horizontal ? fixed : i
    setPixel(pixels, x, y, palette.doorFrame)
    setPixel(pixels, x, y + (horizontal ? inward : 0) + (!horizontal ? inward : 0), palette.door)
  }

  if (horizontal) {
    line(pixels, 29, fixed, 35, fixed, palette.doorLight)
    setPixel(pixels, 34, fixed + inward, palette.metal)
  } else {
    line(pixels, fixed, 29, fixed, 35, palette.doorLight)
    setPixel(pixels, fixed + inward, 34, palette.metal)
  }
}

const addWall = (pixels: Map<string, string>, direction: Direction) => {
  if (direction === 'N' || direction === 'S') {
    const y = direction === 'N' ? WALL_START - 1 : WALL_END + 1
    const innerY = direction === 'N' ? WALL_START : WALL_END
    for (let x = WALL_START; x <= WALL_END; x++) {
      setPixel(pixels, x, y, palette.wallShadow)
      setPixel(pixels, x, innerY, palette.wall)
      if (x > WALL_START + 1 && x < WALL_END - 1) {
        setPixel(pixels, x, direction === 'N' ? innerY + 1 : innerY - 1, palette.wallLight)
      }
    }
  } else {
    const x = direction === 'W' ? WALL_START - 1 : WALL_END + 1
    const innerX = direction === 'W' ? WALL_START : WALL_END
    for (let y = WALL_START; y <= WALL_END; y++) {
      setPixel(pixels, x, y, palette.wallShadow)
      setPixel(pixels, innerX, y, palette.wall)
      if (y > WALL_START + 1 && y < WALL_END - 1) {
        setPixel(pixels, direction === 'W' ? innerX + 1 : innerX - 1, y, palette.wallLight)
      }
    }
  }
}

const addFloorDetails = (pixels: Map<string, string>) => {
  // Tile joints are only drawn over existing floor, so they never float in the void.
  for (const x of [8, 16, 24, 32, 40, 48, 56]) {
    for (let y = 0; y < SIZE; y++) {
      if (pixels.has(`${x},${y}`)) setPixel(pixels, x, y, palette.grout)
    }
  }
  for (const y of [8, 16, 24, 32, 40, 48, 56]) {
    for (let x = 0; x < SIZE; x++) {
      if (pixels.has(`${x},${y}`)) setPixel(pixels, x, y, palette.grout)
    }
  }

  // Wear, stains and debris stay in the broad central floor area.
  ;[[28, 27], [29, 27], [30, 27], [31, 28], [32, 28], [33, 28]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.floorLight),
  )
  ;[[25, 35], [26, 35], [26, 36], [27, 36], [28, 37], [29, 37]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.blood),
  )
  ;[[26, 35], [28, 37]].forEach(([x, y]) => setPixel(pixels, x, y, palette.bloodLight))
  ;[[37, 31], [38, 31], [37, 32], [36, 33], [38, 33], [39, 34]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.paper),
  )
  setPixel(pixels, 39, 33, palette.paperShadow)
  ;[[30, 39], [31, 39], [34, 24], [35, 24], [39, 28], [40, 28]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.debris),
  )
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
        const variation = (Math.floor(x / 8) + Math.floor(y / 8)) % 3
        setPixel(pixels, x, y, variation === 0 ? palette.floorLight : variation === 1 ? palette.floor : palette.floorDark)
      }
    }
  }

  addFloorDetails(pixels)

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
