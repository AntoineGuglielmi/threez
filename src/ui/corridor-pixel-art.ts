import { corridorDefinitions, directionOrder, rotateDirection } from '../game/directions'
import type { CorridorCard, Direction } from '../game/types'

type Pixel = { x: number; y: number; color: string }

const palette = {
  void: '#171d20',
  floor: '#626b6d',
  floorLight: '#858b83',
  floorMid: '#707875',
  floorDark: '#4b5659',
  grout: '#424c4e',
  wallTop: '#a4a99e',
  wallLight: '#c2c2b2',
  wall: '#858e89',
  wallFace: '#626d6c',
  wallShadow: '#354144',
  doorFrame: '#d0b18a',
  door: '#76513d',
  doorLight: '#b47d56',
  doorShadow: '#3f3029',
  paper: '#d4c9a9',
  paperShadow: '#887f6d',
  blood: '#783d3b',
  bloodLight: '#a64c47',
  debris: '#30383b',
  metal: '#c0c7bf',
} as const

const SIZE = 64
// The walkable area deliberately takes most of the card; walls stay secondary.
const FLOOR_START = 12
const FLOOR_END = 51
const PASSAGE_START = 12
const PASSAGE_END = 51
const PASSAGE_CENTER = 31
const WALL_DEPTH = 4
const DOOR_HALF_WIDTH = 7

const setPixel = (pixels: Map<string, string>, x: number, y: number, color: string) => {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) pixels.set(`${x},${y}`, color)
}

const hasPixel = (pixels: Map<string, string>, x: number, y: number) =>
  pixels.has(`${x},${y}`)

const line = (pixels: Map<string, string>, x1: number, y1: number, x2: number, y2: number, color: string) => {
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

const isFloor = (x: number, y: number, exits: Direction[]) => {
  const inCenter = x >= FLOOR_START && x <= FLOOR_END && y >= FLOOR_START && y <= FLOOR_END
  const inNorth = exits.includes('N') && x >= PASSAGE_START && x <= PASSAGE_END && y < FLOOR_START
  const inSouth = exits.includes('S') && x >= PASSAGE_START && x <= PASSAGE_END && y > FLOOR_END
  const inWest = exits.includes('W') && y >= PASSAGE_START && y <= PASSAGE_END && x < FLOOR_START
  const inEast = exits.includes('E') && y >= PASSAGE_START && y <= PASSAGE_END && x > FLOOR_END
  return inCenter || inNorth || inSouth || inWest || inEast
}

const isDoorOpening = (direction: Direction, x: number, y: number) => {
  if (direction === 'N' || direction === 'S') {
    const wallY = direction === 'N' ? FLOOR_START : FLOOR_END
    return y === wallY && Math.abs(x - PASSAGE_CENTER) <= DOOR_HALF_WIDTH
  }
  const wallX = direction === 'W' ? FLOOR_START : FLOOR_END
  return x === wallX && Math.abs(y - PASSAGE_CENTER) <= DOOR_HALF_WIDTH
}

const addWalls = (pixels: Map<string, string>, exits: Direction[], doors: Direction[]) => {
  const floor = new Set<string>()
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (isFloor(x, y, exits)) floor.add(`${x},${y}`)
    }
  }

  const edges: Array<{ x: number; y: number; direction: Direction }> = []
  const neighbors: Record<Direction, [number, number]> = {
    N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0],
  }

  for (const key of floor) {
    const [x, y] = key.split(',').map(Number)
    for (const direction of directionOrder) {
      const [dx, dy] = neighbors[direction]
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || floor.has(`${nx},${ny}`)) continue
      // The outer edge of a corridor exit remains open so it can connect to another card.
      if ((direction === 'N' && y === 0) || (direction === 'S' && y === SIZE - 1)
        || (direction === 'W' && x === 0) || (direction === 'E' && x === SIZE - 1)) continue
      if (doors.some((door) => door === direction && isDoorOpening(door, x, y))) continue
      edges.push({ x, y, direction })
    }
  }

  for (const { x, y, direction } of edges) {
    const [dx, dy] = neighbors[direction]
    // A narrow, layered wall rim: dark outer side, solid face and a lit cap.
    for (let depth = 1; depth <= WALL_DEPTH; depth++) {
      const wx = x + dx * depth
      const wy = y + dy * depth
      const color = depth === 1
        ? palette.wallFace
        : depth === WALL_DEPTH
          ? palette.wallTop
          : depth === WALL_DEPTH - 1
            ? palette.wallLight
            : palette.wall
      setPixel(pixels, wx, wy, color)
    }
    setPixel(pixels, x, y, palette.wallShadow)
  }
}

const addDoor = (pixels: Map<string, string>, direction: Direction) => {
  const horizontalWall = direction === 'N' || direction === 'S'
  const inward: [number, number] = direction === 'N' ? [0, 1]
    : direction === 'S' ? [0, -1]
      : direction === 'W' ? [1, 0]
        : [-1, 0]
  const tangent: [number, number] = horizontalWall ? [1, 0] : [0, 1]
  const wallLine = direction === 'N' || direction === 'W' ? FLOOR_START : FLOOR_END

  // Door sill and jambs interrupt the wall instead of sitting on top of it.
  for (let offset = -DOOR_HALF_WIDTH; offset <= DOOR_HALF_WIDTH; offset++) {
    const x = horizontalWall ? PASSAGE_CENTER + offset : wallLine
    const y = horizontalWall ? wallLine : PASSAGE_CENTER + offset
    setPixel(pixels, x, y, palette.doorFrame)
    if (offset === -DOOR_HALF_WIDTH || offset === DOOR_HALF_WIDTH) {
      for (let depth = 1; depth <= 2; depth++) {
        setPixel(
          pixels,
          horizontalWall ? x : x + (direction === 'W' ? depth : -depth),
          horizontalWall ? y + (direction === 'N' ? depth : -depth) : y,
          depth === 1 ? palette.doorLight : palette.doorShadow,
        )
      }
    }
  }

  // The leaf opens into the corridor. Its two long edges and its short end
  // are separate pixel lines, giving the door a visible top, bottom and thickness.
  const hingeOffset = -5
  const hingeX = horizontalWall ? PASSAGE_CENTER + hingeOffset : wallLine + inward[0]
  const hingeY = horizontalWall ? wallLine + inward[1] : PASSAGE_CENTER + hingeOffset
  const length = 11
  const width = 3
  const points: Array<[number, number]> = [
    [hingeX, hingeY],
    [hingeX + inward[0] * length + tangent[0], hingeY + inward[1] * length + tangent[1]],
    [hingeX + inward[0] * length + tangent[0] * (width + 1), hingeY + inward[1] * length + tangent[1] * (width + 1)],
    [hingeX + tangent[0] * width, hingeY + tangent[1] * width],
  ]

  fillPolygon(pixels, points, palette.door)
  line(pixels, ...points[0], ...points[1], palette.doorLight)
  line(pixels, ...points[1], ...points[2], palette.doorShadow)
  line(pixels, ...points[2], ...points[3], palette.doorShadow)
  line(pixels, ...points[3], ...points[0], palette.doorLight)
  setPixel(pixels, hingeX, hingeY, palette.metal)
}
const addFloorDetails = (pixels: Map<string, string>) => {
  // Broken tile joints follow the floor shape and never cross walls or empty space.
  for (const y of [8, 20, 32, 44, 56]) {
    for (let x = 0; x < SIZE; x++) {
      if (hasPixel(pixels, x, y) && hasPixel(pixels, x, y - 1) && hasPixel(pixels, x, y + 1)) {
        setPixel(pixels, x, y, palette.grout)
      }
    }
  }
  for (const x of [8, 20, 32, 44, 56]) {
    for (let y = 0; y < SIZE; y++) {
      if (hasPixel(pixels, x, y) && hasPixel(pixels, x - 1, y) && hasPixel(pixels, x + 1, y)) {
        setPixel(pixels, x, y, palette.grout)
      }
    }
  }

  // A few deliberate floor highlights, stains and small debris.
  ;[[25, 26], [26, 26], [27, 27], [28, 27], [29, 27], [30, 28], [31, 28]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.floorLight),
  )
  ;[[22, 38], [23, 38], [23, 39], [24, 39], [25, 40], [26, 40], [27, 41]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.blood),
  )
  ;[[23, 38], [25, 40], [27, 41]].forEach(([x, y]) => setPixel(pixels, x, y, palette.bloodLight))
  ;[[37, 29], [38, 29], [37, 30], [36, 31], [38, 31], [39, 32], [40, 32]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.paper),
  )
  setPixel(pixels, 39, 31, palette.paperShadow)
  ;[[30, 43], [31, 43], [34, 22], [35, 22], [39, 26], [40, 26]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.debris),
  )
}


const buildStraightPerspective = (card: CorridorCard): Pixel[] => {
  const pixels = new Map<string, string>()

  // Elevated three-quarter view: the camera looks down into an open corridor.
  // The floor is fully visible; wall tops and their inner faces create depth.
  fillPolygon(pixels, [[0, 0], [64, 0], [64, 63], [0, 63]], palette.void)

  // Outer wall volumes, including the broad top planes visible from above.
  fillPolygon(pixels, [[0, 0], [14, 5], [7, 57], [0, 63]], palette.wallShadow)
  fillPolygon(pixels, [[64, 0], [50, 5], [57, 57], [64, 63]], palette.wallShadow)

  // Wall caps: their width is deliberately visible from the elevated camera.
  fillPolygon(pixels, [[0, 0], [14, 5], [25, 10], [19, 13], [7, 8]], palette.wallTop)
  fillPolygon(pixels, [[64, 0], [50, 5], [39, 10], [45, 13], [57, 8]], palette.wallTop)
  fillPolygon(pixels, [[14, 5], [25, 10], [8, 59], [0, 54]], palette.wallLight)
  fillPolygon(pixels, [[50, 5], [39, 10], [56, 59], [64, 54]], palette.wallLight)

  // Inner vertical faces, directly bordering the walkable floor.
  fillPolygon(pixels, [[19, 13], [25, 10], [8, 59], [4, 56]], palette.wallFace)
  fillPolygon(pixels, [[45, 13], [39, 10], [56, 59], [60, 56]], palette.wallFace)
  line(pixels, 25, 10, 8, 59, palette.wallShadow)
  line(pixels, 39, 10, 56, 59, palette.wallShadow)

  // Floor seen from above, narrowing towards the far end of the corridor.
  fillPolygon(pixels, [[25, 10], [39, 10], [56, 59], [8, 59]], palette.floor)
  fillPolygon(pixels, [[27, 13], [37, 13], [52, 57], [12, 57]], palette.floorMid)

  // Perspective tile joints follow the floor plane.
  for (const y of [23, 34, 45, 54]) {
    const spread = Math.round(5 + (y - 10) * 0.43)
    line(pixels, 32 - spread, y, 32 + spread, y, palette.grout)
  }
  line(pixels, 32, 12, 17, 58, palette.grout)
  line(pixels, 32, 12, 47, 58, palette.grout)

  // Closed door leaves are mounted vertically on the inner wall faces.
  // Their foreshortened panels follow the wall perspective; none opens onto the floor.
  if (card.doors.includes('W')) {
    fillPolygon(pixels, [[13, 30], [19, 25], [15, 38], [10, 43]], palette.doorShadow)
    fillPolygon(pixels, [[14, 30], [18, 27], [14, 38], [11, 41]], palette.door)
    line(pixels, 14, 30, 18, 27, palette.doorLight)
    line(pixels, 14, 30, 11, 41, palette.doorLight)
    line(pixels, 18, 27, 14, 38, palette.doorShadow)
    setPixel(pixels, 15, 35, palette.metal)
  }
  if (card.doors.includes('E')) {
    fillPolygon(pixels, [[51, 25], [57, 30], [54, 43], [49, 38]], palette.doorShadow)
    fillPolygon(pixels, [[52, 27], [56, 30], [53, 41], [50, 38]], palette.door)
    line(pixels, 52, 27, 56, 30, palette.doorLight)
    line(pixels, 52, 27, 50, 38, palette.doorLight)
    line(pixels, 56, 30, 53, 41, palette.doorShadow)
    setPixel(pixels, 51, 35, palette.metal)
  }

  // A few restrained marks on the floor, kept inside the walkable polygon.
  ;[[29, 39], [30, 39], [31, 40], [32, 40], [33, 41]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.floorLight),
  )
  ;[[25, 49], [26, 49], [26, 50], [27, 50]].forEach(([x, y]) =>
    setPixel(pixels, x, y, palette.blood),
  )

  return [...pixels].map(([key, color]) => {
    const [x, y] = key.split(',').map(Number)
    return { x, y, color }
  })
}
const buildPixels = (card: CorridorCard, turns: number): Pixel[] => {
  const exits = corridorDefinitions[card.kind].exits.map((direction) => rotateDirection(direction, turns))
  const doors = card.doors
    .map((direction) => rotateDirection(direction, turns))
    .filter((direction) => !exits.includes(direction))
  const pixels = new Map<string, string>()

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isFloor(x, y, exits)) continue
      const variation = (Math.floor(x / 7) * 2 + Math.floor(y / 9)) % 4
      const color = variation === 0
        ? palette.floorLight
        : variation === 1
          ? palette.floorMid
          : variation === 2
            ? palette.floor
            : palette.floorDark
      setPixel(pixels, x, y, color)
    }
  }

  addFloorDetails(pixels)
  addWalls(pixels, exits, doors)
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
  const pixels = card.kind === 'straight' && turns === 0
    ? buildStraightPerspective(card)
    : buildPixels(card, turns)
  image.innerHTML = pixels
    .map(({ x, y, color }) => `<span class="cc-pixel" style="--x:${x};--y:${y};--pixel-color:${color}"></span>`)
    .join('')
  return image
}
