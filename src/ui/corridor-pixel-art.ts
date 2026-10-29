import { corridorDefinitions, directionOrder, rotateDirection } from '../game/directions'
import type { CorridorCard, Direction } from '../game/types'

type Pixel = { x: number; y: number; color: string }

const palette = {
  floor: '#596267',
  floorLight: '#737b7e',
  floorDark: '#414b50',
  grout: '#343e43',
  wall: '#929994',
  wallLight: '#b8bbb0',
  wallShadow: '#41494b',
  doorFrame: '#d0b18a',
  door: '#76513d',
  doorLight: '#a87550',
  doorShadow: '#3f3029',
  paper: '#d4c9a9',
  paperShadow: '#887f6d',
  blood: '#783d3b',
  bloodLight: '#a64c47',
  debris: '#30383b',
  metal: '#aeb9b8',
} as const

const SIZE = 64
// Wide passages: the walkable area is close to half the tile width.
const FLOOR_START = 18
const FLOOR_END = 45
const ARM_START = 18
const ARM_END = 45
const WALL_OUTER = 17
const WALL_INNER = 18
const PASSAGE_CENTER = 31

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
  // Bresenham: advance each axis independently so non-45° segments always terminate.
  let x = x1
  let y = y1
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  const stepX = x1 < x2 ? 1 : -1
  const stepY = y1 < y2 ? 1 : -1
  let error = dx - dy

  while (true) {
    setPixel(pixels, x, y, color)
    if (x === x2 && y === y2) break

    const doubledError = error * 2
    if (doubledError > -dy) {
      error -= dy
      x += stepX
    }
    if (doubledError < dx) {
      error += dx
      y += stepY
    }
  }
}

const fillPolygon = (
  pixels: Map<string, string>,
  points: Array<[number, number]>,
  color: string,
) => {
  const minX = Math.min(...points.map(([x]) => x))
  const maxX = Math.max(...points.map(([x]) => x))
  const minY = Math.min(...points.map(([, y]) => y))
  const maxY = Math.max(...points.map(([, y]) => y))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i]
        const [xj, yj] = points[j]
        const intersects = yi > y !== yj > y
          && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersects) inside = !inside
      }
      if (inside) setPixel(pixels, x, y, color)
    }
  }
}

const addDoor = (pixels: Map<string, string>, direction: Direction) => {
  const horizontal = direction === 'N' || direction === 'S'
  const inward = direction === 'N' || direction === 'W' ? 1 : -1
  const wallLine = direction === 'N' || direction === 'W' ? WALL_OUTER : 46
  const halfOpening = 8

  // Threshold and jambs frame the opening in the wall.
  for (let offset = -halfOpening; offset <= halfOpening; offset++) {
    const x = horizontal ? PASSAGE_CENTER + offset : wallLine
    const y = horizontal ? wallLine : PASSAGE_CENTER + offset
    setPixel(pixels, x, y, palette.doorFrame)
    if (offset === -halfOpening || offset === halfOpening) {
      setPixel(
        pixels,
        horizontal ? x : x + (direction === 'W' ? 1 : -1),
        horizontal ? y + (direction === 'N' ? 1 : -1) : y,
        palette.doorLight,
      )
    }
  }

  // The open leaf is a small four-sided slab, not a single line:
  // its two long edges make both faces (top and bottom in the card view) visible.
  const hinge = PASSAGE_CENTER - halfOpening + 2
  const length = 11
  const depth = 3
  const baseX = horizontal ? hinge : wallLine + inward
  const baseY = horizontal ? wallLine + inward : hinge
  const tipX = horizontal ? hinge + length : baseX + inward * depth
  const tipY = horizontal ? baseY + inward * depth : hinge + length
  const depthX = horizontal ? 0 : -inward * depth
  const depthY = horizontal ? -inward * depth : 0
  const points: Array<[number, number]> = [
    [baseX, baseY],
    [tipX, tipY],
    [tipX + depthX, tipY + depthY],
    [baseX + depthX, baseY + depthY],
  ]

  fillPolygon(pixels, points, palette.door)
  line(pixels, ...points[0], ...points[1], palette.doorLight)
  line(pixels, ...points[1], ...points[2], palette.doorShadow)
  line(pixels, ...points[2], ...points[3], palette.doorShadow)
  line(pixels, ...points[3], ...points[0], palette.doorLight)
  setPixel(pixels, baseX, baseY, palette.metal)
}
const addWall = (pixels: Map<string, string>, direction: Direction) => {
  if (direction === 'N' || direction === 'S') {
    const y = direction === 'N' ? WALL_OUTER : 46
    const innerY = direction === 'N' ? WALL_INNER : 45
    for (let x = WALL_OUTER; x <= 46; x++) {
      setPixel(pixels, x, y, palette.wallShadow)
      setPixel(pixels, x, innerY, palette.wall)
      if (x > WALL_OUTER + 1 && x < 45) setPixel(pixels, x, direction === 'N' ? innerY + 1 : innerY - 1, palette.wallLight)
    }
  } else {
    const x = direction === 'W' ? WALL_OUTER : 46
    const innerX = direction === 'W' ? WALL_INNER : 45
    for (let y = WALL_OUTER; y <= 46; y++) {
      setPixel(pixels, x, y, palette.wallShadow)
      setPixel(pixels, innerX, y, palette.wall)
      if (y > WALL_OUTER + 1 && y < 45) setPixel(pixels, direction === 'W' ? innerX + 1 : innerX - 1, y, palette.wallLight)
    }
  }
}

const addFloorDetails = (pixels: Map<string, string>) => {
  // Tile joints follow the floor silhouette and never cross the surrounding void.
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

  // Floor wear, stains and debris are deliberately small accents in the larger walkable area.
  ;[[26, 27], [27, 27], [28, 27], [29, 28], [30, 28], [31, 28], [32, 28]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.floorLight),
  )
  ;[[23, 36], [24, 36], [24, 37], [25, 37], [26, 38], [27, 38], [28, 39]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.blood),
  )
  ;[[24, 36], [26, 38], [28, 39]].forEach(([x, y]) => setPixel(pixels, x, y, palette.bloodLight))
  ;[[37, 29], [38, 29], [37, 30], [36, 31], [38, 31], [39, 32], [40, 32]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.paper),
  )
  setPixel(pixels, 39, 31, palette.paperShadow)
  ;[[30, 41], [31, 41], [34, 23], [35, 23], [39, 27], [40, 27]].forEach(([x, y]) =>
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
