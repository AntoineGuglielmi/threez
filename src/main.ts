import * as THREE from 'three'
import './style.css'

const root = document.querySelector<HTMLDivElement>('#scene-root')

if (!root) {
  throw new Error('Scene root not found')
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('#050607')
scene.fog = new THREE.FogExp2('#050607', 0.035)

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 180)
camera.position.set(13, 16, 13)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(root.clientWidth, root.clientHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.82
root.appendChild(renderer.domElement)

scene.add(new THREE.AmbientLight('#9ca3ad', 0.55))

const keyLight = new THREE.DirectionalLight('#d9dce2', 2.1)
keyLight.position.set(8, 15, 7)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(2048, 2048)
keyLight.shadow.camera.left = -10
keyLight.shadow.camera.right = 10
keyLight.shadow.camera.top = 10
keyLight.shadow.camera.bottom = -10
keyLight.shadow.bias = -0.0004
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight('#7b8494', 0.45)
fillLight.position.set(-8, 6, -5)
scene.add(fillLight)

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: '#080a0d', roughness: 1 }),
  start: new THREE.MeshStandardMaterial({ color: '#39302d', roughness: 0.9 }),
  startTop: new THREE.MeshStandardMaterial({ color: '#51413a', roughness: 0.92 }),
  wood: new THREE.MeshStandardMaterial({ color: '#332923', roughness: 0.98 }),
  woodLight: new THREE.MeshStandardMaterial({ color: '#594438', roughness: 0.98 }),
  frame: new THREE.MeshStandardMaterial({ color: '#25272a', roughness: 0.9 }),
  tileNeon: new THREE.MeshStandardMaterial({
    color: '#a8d9e8',
    emissive: '#4a9bb9',
    emissiveIntensity: 1.35,
    roughness: 0.35,
    metalness: 0.15,
  }),
}

// The ground has no visible edge: the world simply disappears into the fog.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), materials.floor)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.18
floor.receiveShadow = true
scene.add(floor)

// A broad placement grid fades into darkness instead of ending at a board border.
const gridSize = 120
const grid = new THREE.GridHelper(gridSize, gridSize, '#343940', '#24282e')
grid.position.y = -0.012
const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
gridMaterials.forEach((material) => {
  const lineMaterial = material as THREE.LineBasicMaterial
  lineMaterial.transparent = true
  lineMaterial.opacity = 0.42
  lineMaterial.depthWrite = false
})
scene.add(grid)

// A single starting tile floats visually in a large, unexplored space.
const start = new THREE.Group()
start.position.set(0, 0.025, 0)
scene.add(start)

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.2, 48),
  new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.55, depthWrite: false }),
)
shadow.rotation.x = -Math.PI / 2
shadow.position.y = -0.005
shadow.scale.set(1.2, 0.82, 1)
start.add(shadow)

const slab = new THREE.Mesh(
  new THREE.BoxGeometry(1.18, 0.14, 1.18),
  materials.start,
)
slab.position.y = 0.07
slab.castShadow = true
slab.receiveShadow = true
start.add(slab)

const top = new THREE.Mesh(
  new THREE.BoxGeometry(1.08, 0.025, 1.08),
  materials.startTop,
)
top.position.y = 0.152
top.receiveShadow = true
start.add(top)

// Cool neon strips trace the tile edges, like floor lighting in an abandoned facility.
const neon = new THREE.Group()
neon.position.y = 0.168
start.add(neon)

const neonLength = 0.92
const neonWidth = 0.018
const neonOffset = 0.49
for (const side of [-1, 1]) {
  const stripX = new THREE.Mesh(
    new THREE.BoxGeometry(neonWidth, 0.012, neonLength),
    materials.tileNeon,
  )
  stripX.position.set(side * neonOffset, 0, 0)
  neon.add(stripX)

  const stripZ = new THREE.Mesh(
    new THREE.BoxGeometry(neonLength, 0.012, neonWidth),
    materials.tileNeon,
  )
  stripZ.position.set(0, 0, side * neonOffset)
  neon.add(stripZ)
}

// A restrained pool of cold light brightens the tile without washing out the scene.
const tileLight = new THREE.PointLight('#83c8e4', 1.15, 3.8, 2)
tileLight.position.set(0, 0.42, 0)
start.add(tileLight)

// Barricaded hospital entrance.
const framePosts = [-0.34, 0.34]
for (const x of framePosts) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.57, 0.075), materials.frame)
  post.position.set(x, 0.44, -0.34)
  post.castShadow = true
  start.add(post)
}

const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.075), materials.frame)
lintel.position.set(0, 0.72, -0.34)
lintel.castShadow = true
start.add(lintel)

const door = new THREE.Mesh(
  new THREE.BoxGeometry(0.53, 0.43, 0.055),
  new THREE.MeshStandardMaterial({ color: '#211d1b', roughness: 0.98 }),
)
door.position.set(0, 0.38, -0.3)
door.castShadow = true
start.add(door)

for (const [index, rotation] of [0.28, -0.28].entries()) {
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.075, 0.09),
    index === 0 ? materials.woodLight : materials.wood,
  )
  plank.position.set(0, 0.39 + index * 0.1, -0.24)
  plank.rotation.z = rotation
  plank.castShadow = true
  start.add(plank)
}

// One small amber marker is the only saturated colour in the scene.
const beacon = new THREE.Mesh(
  new THREE.BoxGeometry(0.11, 0.11, 0.11),
  new THREE.MeshBasicMaterial({ color: '#bd7958' }),
)
beacon.position.set(0.38, 0.24, 0.36)
start.add(beacon)

const beaconLight = new THREE.PointLight('#a86649', 0.5, 2.5)
beaconLight.position.set(0.38, 0.48, 0.36)
start.add(beaconLight)

const resize = () => {
  const width = root.clientWidth
  const height = root.clientHeight
  if (width === 0 || height === 0) return

  const aspect = width / height
  const viewHeight = aspect < 1 ? 22 : 19
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
let currentZoom = 1

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
  zoom = THREE.MathUtils.clamp(zoom + event.deltaY * -0.001, 0.65, 1.7)
}, { passive: false })

renderer.domElement.addEventListener('click', (event) => {
  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObject(start, true)
  root.dataset.selected = hits.length > 0 ? 'start' : 'unknown'
})

const clock = new THREE.Clock()
const animate = () => {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const elapsed = clock.elapsedTime
  start.rotation.y = THREE.MathUtils.damp(start.rotation.y, targetRotation, 4, delta)
  grid.rotation.y = start.rotation.y
  currentZoom = THREE.MathUtils.damp(currentZoom, zoom, 4, delta)
  start.scale.setScalar(currentZoom)
  beacon.scale.y = 1 + Math.sin(elapsed * 2.2) * 0.07
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
