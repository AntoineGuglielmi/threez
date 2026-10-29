import * as THREE from 'three'
import './style.css'

const root = document.querySelector<HTMLDivElement>('#scene-root')

if (!root) {
  throw new Error('Scene root not found')
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('#111411')
scene.fog = new THREE.Fog('#111411', 18, 34)

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100)
camera.position.set(13, 16, 13)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(root.clientWidth, root.clientHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
root.appendChild(renderer.domElement)

const ambient = new THREE.HemisphereLight('#dce8d4', '#252a24', 2.1)
scene.add(ambient)

const keyLight = new THREE.DirectionalLight('#ffe5b0', 3.2)
keyLight.position.set(8, 15, 7)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(2048, 2048)
keyLight.shadow.camera.left = -12
keyLight.shadow.camera.right = 12
keyLight.shadow.camera.top = 12
keyLight.shadow.camera.bottom = -12
keyLight.shadow.bias = -0.0004
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight('#829b9a', 1.1)
fillLight.position.set(-8, 6, -5)
scene.add(fillLight)

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: '#202620', roughness: 1 }),
  tile: new THREE.MeshStandardMaterial({ color: '#293129', roughness: 0.94 }),
  tileAlt: new THREE.MeshStandardMaterial({ color: '#252d26', roughness: 0.94 }),
  tileEdge: new THREE.MeshStandardMaterial({ color: '#39443a', roughness: 0.9 }),
  start: new THREE.MeshStandardMaterial({ color: '#b75c3d', roughness: 0.85 }),
  startTop: new THREE.MeshStandardMaterial({ color: '#d27a4c', roughness: 0.88 }),
  wood: new THREE.MeshStandardMaterial({ color: '#694b32', roughness: 0.98 }),
  woodLight: new THREE.MeshStandardMaterial({ color: '#94704a', roughness: 0.98 }),
  metal: new THREE.MeshStandardMaterial({ color: '#303833', roughness: 0.55, metalness: 0.35 }),
  paper: new THREE.MeshStandardMaterial({ color: '#e5d8ad', roughness: 0.9 }),
}

const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), materials.floor)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.24
floor.receiveShadow = true
scene.add(floor)

const boardSize = 15
const half = (boardSize - 1) / 2
const board = new THREE.Group()
scene.add(board)

// A single continuous base keeps the board readable as a place to build a route.
const base = new THREE.Mesh(
  new THREE.BoxGeometry(boardSize + 0.24, 0.22, boardSize + 0.24),
  new THREE.MeshStandardMaterial({ color: '#171d18', roughness: 1 }),
)
base.position.y = -0.13
base.receiveShadow = true
base.castShadow = true
board.add(base)

const tileGeometry = new THREE.BoxGeometry(0.96, 0.06, 0.96)
const tileTopGeometry = new THREE.PlaneGeometry(0.94, 0.94)

for (let x = 0; x < boardSize; x += 1) {
  for (let z = 0; z < boardSize; z += 1) {
    const isStart = x === Math.floor(boardSize / 2) && z === Math.floor(boardSize / 2)
    const tile = new THREE.Mesh(
      tileGeometry,
      isStart ? materials.start : (x + z) % 2 === 0 ? materials.tile : materials.tileAlt,
    )
    tile.position.set(x - half, 0, z - half)
    tile.receiveShadow = true
    tile.castShadow = isStart
    board.add(tile)

    if (!isStart) {
      const inset = new THREE.Mesh(
        tileTopGeometry,
        new THREE.MeshBasicMaterial({
          color: '#536052',
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
        }),
      )
      inset.rotation.x = -Math.PI / 2
      inset.position.set(x - half, 0.032, z - half)
      board.add(inset)
    }
  }
}

// Fine grid seams, slightly brighter than the tiles but not a glowing hologram.
const grid = new THREE.GridHelper(boardSize, boardSize, '#586653', '#3b463a')
grid.position.y = 0.014
const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
gridMaterials.forEach((material) => {
  const lineMaterial = material as THREE.LineBasicMaterial
  lineMaterial.transparent = true
  lineMaterial.opacity = 0.56
})
board.add(grid)

// Small edge markers give the board a physical, tabletop feel.
const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#4b5747', roughness: 0.8 })
for (let i = 0; i < boardSize; i += 1) {
  for (const edgeZ of [-half - 0.13, half + 0.13]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 0.055), edgeMaterial)
    marker.position.set(i - half, 0.005, edgeZ)
    board.add(marker)
  }
  for (const edgeX of [-half - 0.13, half + 0.13]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 0.055), edgeMaterial)
    marker.position.set(edgeX, 0.005, i - half)
    board.add(marker)
  }
}

// Starting card: a raised concrete slab, barricaded entrance and a restrained warning mark.
const start = new THREE.Group()
start.position.set(0, 0.055, 0)
board.add(start)

const slab = new THREE.Mesh(
  new THREE.BoxGeometry(0.9, 0.08, 0.9),
  new THREE.MeshStandardMaterial({ color: '#b75c3d', roughness: 0.95 }),
)
slab.position.y = 0.045
slab.castShadow = true
slab.receiveShadow = true
start.add(slab)

const top = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.025, 0.76), materials.startTop)
top.position.y = 0.095
top.receiveShadow = true
start.add(top)

// Entrance frame on the back edge of the starting tile.
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#3b3028', roughness: 0.9 })
const framePosts = [-0.27, 0.27]
for (const x of framePosts) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.53, 0.075), frameMaterial)
  post.position.set(x, 0.35, -0.18)
  post.castShadow = true
  start.add(post)
}
const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.075, 0.075), frameMaterial)
lintel.position.set(0, 0.59, -0.18)
lintel.castShadow = true
start.add(lintel)

const door = new THREE.Mesh(
  new THREE.BoxGeometry(0.43, 0.39, 0.045),
  new THREE.MeshStandardMaterial({ color: '#593f31', roughness: 0.95 }),
)
door.position.set(0, 0.31, -0.15)
door.castShadow = true
start.add(door)

// Crossed planks across the entrance.
for (const [index, rotation] of [0.28, -0.28].entries()) {
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.075, 0.09),
    index === 0 ? materials.woodLight : materials.wood,
  )
  plank.position.set(0, 0.32 + index * 0.08, -0.105)
  plank.rotation.z = rotation
  plank.castShadow = true
  start.add(plank)
}

// A small, warm warning light makes the starting tile easy to identify.
const beacon = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.12, 0.12),
  new THREE.MeshBasicMaterial({ color: '#f5bd69' }),
)
beacon.position.set(0.29, 0.2, 0.27)
start.add(beacon)

const beaconLight = new THREE.PointLight('#e78b4e', 0.7, 2.2)
beaconLight.position.set(0.29, 0.45, 0.27)
start.add(beaconLight)

// Keep the tile on screen and let the camera adapt to the available viewport.
const resize = () => {
  const width = root.clientWidth
  const height = root.clientHeight
  if (width === 0 || height === 0) return

  const aspect = width / height
  const viewHeight = aspect < 1 ? 22 : 18
  camera.left = (-viewHeight * aspect) / 2
  camera.right = (viewHeight * aspect) / 2
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let isDragging = false
let previousPointer = { x: 0, y: 0 }
let targetRotation = 0
let zoom = 1

renderer.domElement.addEventListener('pointerdown', (event) => {
  isDragging = true
  previousPointer = { x: event.clientX, y: event.clientY }
  renderer.domElement.setPointerCapture(event.pointerId)
})

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isDragging) return
  const deltaX = event.clientX - previousPointer.x
  targetRotation += deltaX * 0.003
  previousPointer = { x: event.clientX, y: event.clientY }
})

renderer.domElement.addEventListener('pointerup', () => {
  isDragging = false
})

renderer.domElement.addEventListener('pointercancel', () => {
  isDragging = false
})

renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault()
  zoom = THREE.MathUtils.clamp(zoom + event.deltaY * -0.001, 0.7, 1.5)
}, { passive: false })

renderer.domElement.addEventListener('click', (event) => {
  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObject(start, true)
  root.dataset.selected = hits.length > 0 ? 'start' : 'board'
})

const clock = new THREE.Clock()
const animate = () => {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  board.rotation.y = THREE.MathUtils.damp(board.rotation.y, targetRotation, 4, clock.getDelta())
  const scale = THREE.MathUtils.damp(board.scale.x, zoom, 4, 1 / 60)
  board.scale.setScalar(scale)
  beacon.scale.y = 1 + Math.sin(elapsed * 2.5) * 0.08
  renderer.render(scene, camera)
}

const observer = new ResizeObserver(resize)
observer.observe(root)
resize()
animate()

window.addEventListener('beforeunload', () => {
  observer.disconnect()
  renderer.dispose()
})
