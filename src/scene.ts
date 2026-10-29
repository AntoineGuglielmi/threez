import * as THREE from 'three'
import type { SurvivorKind } from './game/types'

export const createScene = (activeSurvivorKind: SurvivorKind) => {
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
  renderer.toneMappingExposure = 1.05
  root.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight('#b8c7d5', 0.85))
  scene.add(new THREE.HemisphereLight('#dceeff', '#34363d', 0.7))

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

  const fillLight = new THREE.DirectionalLight('#9bcde0', 0.7)
  fillLight.position.set(-8, 6, -5)
  scene.add(fillLight)

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: '#080a0d', roughness: 1 }),
    start: new THREE.MeshStandardMaterial({ color: '#39302d', roughness: 0.9 }),
    startTop: new THREE.MeshStandardMaterial({
      color: '#747d84',
      emissive: '#172b32',
      emissiveIntensity: 0.65,
      roughness: 0.82,
    }),
    wood: new THREE.MeshStandardMaterial({ color: '#332923', roughness: 0.98 }),
    woodLight: new THREE.MeshStandardMaterial({ color: '#594438', roughness: 0.98 }),
    frame: new THREE.MeshStandardMaterial({ color: '#25272a', roughness: 0.9 }),
    corridorWall: new THREE.MeshStandardMaterial({
      color: '#35434b',
      roughness: 0.78,
      metalness: 0.28,
    }),
    corridorPanel: new THREE.MeshStandardMaterial({
      color: '#56616a',
      roughness: 0.68,
      metalness: 0.32,
    }),
    floorPanel: new THREE.MeshStandardMaterial({
      color: '#59636a',
      roughness: 0.82,
      metalness: 0.16,
    }),
    floorPanelDark: new THREE.MeshStandardMaterial({
      color: '#30383e',
      roughness: 0.9,
      metalness: 0.12,
    }),
    warning: new THREE.MeshStandardMaterial({
      color: '#e0a45d',
      emissive: '#9b4e18',
      emissiveIntensity: 0.8,
      roughness: 0.5,
    }),
    tileNeon: new THREE.MeshStandardMaterial({
      color: '#e0faff',
      emissive: '#59c9f3',
      emissiveIntensity: 3.8,
      roughness: 0.22,
      metalness: 0.05,
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
  const board = new THREE.Group()
  scene.add(board)

  const start = new THREE.Group()
  start.position.set(0, 0.025, 0)
  board.add(start)

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

  // The starting room reads as a short hospital corridor, with modular floor panels.
  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.009, 0.32),
        (x + z) % 2 === 0 ? materials.floorPanel : materials.floorPanelDark,
      )
      panel.position.set(x * 0.34, 0.169, z * 0.34)
      panel.receiveShadow = true
      start.add(panel)
    }
  }

  // Low industrial walls frame the passage without hiding the floor or entrance.
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.29, 0.78),
      materials.corridorWall,
    )
    wall.position.set(side * 0.49, 0.31, 0.045)
    wall.castShadow = true
    wall.receiveShadow = true
    start.add(wall)

    for (const z of [-0.2, 0.16, 0.42]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.13, 0.19),
        materials.corridorPanel,
      )
      panel.position.set(side * 0.455, 0.32, z)
      start.add(panel)
    }

    const safetyStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.025, 0.76),
      materials.warning,
    )
    safetyStripe.position.set(side * 0.452, 0.205, 0.045)
    start.add(safetyStripe)
  }

  // Small amber floor markers add a little warmth against the cold neon.
  for (const z of [-0.22, 0.22]) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.012, 0.045),
      materials.warning,
    )
    marker.position.set(0, 0.18, z)
    start.add(marker)
  }

  // Cool neon strips trace the tile edges, like floor lighting in an abandoned facility.
  const neon = new THREE.Group()
  neon.position.y = 0.168
  start.add(neon)

  const neonLength = 0.92
  const neonWidth = 0.032
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

  // The neon strips cast a strong, cool pool of light across the tile itself.
  const tileLight = new THREE.PointLight('#75d9ff', 4.2, 5.2, 1.5)
  tileLight.position.set(0, 0.48, 0)
  start.add(tileLight)

  // Additional low lights keep the corners bright instead of leaving only a lit outline.
  for (const x of [-0.38, 0.38]) {
    for (const z of [-0.38, 0.38]) {
      const cornerLight = new THREE.PointLight('#64c9f4', 1.15, 2.2, 1.8)
      cornerLight.position.set(x, 0.24, z)
      start.add(cornerLight)
    }
  }

  // Survivors are simple low-poly figures built from primitives, so they stay editable in code.
  const characterMaterials = {
    hood: new THREE.MeshStandardMaterial({ color: '#17232b', roughness: 0.92 }),
    stealthCloth: new THREE.MeshStandardMaterial({ color: '#263d49', roughness: 0.86 }),
    skin: new THREE.MeshStandardMaterial({ color: '#b77f64', roughness: 0.92 }),
    skinShadow: new THREE.MeshStandardMaterial({ color: '#523d37', roughness: 0.98 }),
    heavyCloth: new THREE.MeshStandardMaterial({ color: '#665447', roughness: 0.95 }),
    heavyVest: new THREE.MeshStandardMaterial({ color: '#34383a', roughness: 0.95 }),
    military: new THREE.MeshStandardMaterial({ color: '#46543b', roughness: 0.94 }),
    militaryDark: new THREE.MeshStandardMaterial({ color: '#303a2c', roughness: 0.98 }),
    beret: new THREE.MeshStandardMaterial({ color: '#743c3e', roughness: 0.9 }),
    labCoat: new THREE.MeshStandardMaterial({ color: '#d5d8d6', roughness: 0.92 }),
    labShadow: new THREE.MeshStandardMaterial({ color: '#7f9399', roughness: 0.85 }),
    shirt: new THREE.MeshStandardMaterial({ color: '#4d4641', roughness: 0.95 }),
    trousers: new THREE.MeshStandardMaterial({ color: '#34373b', roughness: 0.98 }),
    boot: new THREE.MeshStandardMaterial({ color: '#17191b', roughness: 0.95 }),
    glasses: new THREE.MeshStandardMaterial({ color: '#202a31', metalness: 0.65, roughness: 0.3 }),
    lens: new THREE.MeshStandardMaterial({ color: '#8ec7d8', metalness: 0.25, roughness: 0.2 }),
    activeRing: new THREE.MeshBasicMaterial({ color: '#75d9ff' }),
  }

  const makePart = (
    parent: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  const createCharacter = (kind: 'stealth' | 'heavy' | 'military' | 'scientist' | 'injured') => {
    const character = new THREE.Group()
    const torsoMaterials = {
      stealth: characterMaterials.stealthCloth,
      heavy: characterMaterials.heavyCloth,
      military: characterMaterials.military,
      scientist: characterMaterials.labCoat,
      injured: characterMaterials.shirt,
    }
    const torsoMaterial = torsoMaterials[kind]
    const torsoWidth = kind === 'heavy' ? 0.28 : kind === 'scientist' ? 0.19 : 0.21
    const torsoHeight = kind === 'injured' ? 0.27 : 0.31
    const lean = kind === 'injured' ? -0.22 : 0

    // Legs and boots. The injured survivor's uneven stance hints at his limp.
    for (const side of [-1, 1]) {
      const legX = side * (kind === 'heavy' ? 0.085 : 0.06)
      const legRotation = kind === 'injured' && side === 1 ? -0.22 : 0
      makePart(
        character,
        new THREE.BoxGeometry(kind === 'heavy' ? 0.09 : 0.065, 0.2, 0.075),
        kind === 'military' ? characterMaterials.militaryDark : characterMaterials.trousers,
        [legX, 0.115, side === 1 && kind === 'injured' ? 0.055 : 0],
        [legRotation, 0, 0],
      )
      makePart(
        character,
        new THREE.BoxGeometry(0.085, 0.055, 0.13),
        characterMaterials.boot,
        [legX, 0.035, 0.025],
        [0, 0, kind === 'injured' && side === 1 ? -0.18 : 0],
      )
    }

    // Torso, shoulders and arms.
    makePart(
      character,
      new THREE.BoxGeometry(torsoWidth, torsoHeight, 0.13),
      torsoMaterial,
      [0, 0.34, 0],
      [0, 0, lean],
    )

    if (kind === 'heavy') {
      makePart(character, new THREE.BoxGeometry(0.39, 0.13, 0.16), characterMaterials.heavyVest, [0, 0.47, 0])
      makePart(character, new THREE.BoxGeometry(0.22, 0.2, 0.145), characterMaterials.heavyVest, [0, 0.34, 0.075])
    } else if (kind === 'military') {
      makePart(character, new THREE.BoxGeometry(0.24, 0.11, 0.15), characterMaterials.militaryDark, [0, 0.39, 0.075])
      for (const side of [-1, 1]) {
        makePart(character, new THREE.BoxGeometry(0.065, 0.075, 0.035), characterMaterials.heavyCloth, [side * 0.105, 0.33, 0.09])
      }
    } else if (kind === 'scientist') {
      // Open lab coat panels and a dark shirt give the silhouette a clear white coat.
      makePart(character, new THREE.BoxGeometry(0.075, 0.28, 0.035), characterMaterials.labShadow, [-0.055, 0.34, 0.078])
      makePart(character, new THREE.BoxGeometry(0.075, 0.28, 0.035), characterMaterials.labShadow, [0.055, 0.34, 0.078])
    } else if (kind === 'injured') {
      makePart(character, new THREE.BoxGeometry(0.07, 0.1, 0.035), characterMaterials.skinShadow, [0.07, 0.39, 0.08])
    }

    for (const side of [-1, 1]) {
      const shoulderX = side * (kind === 'heavy' ? 0.19 : kind === 'scientist' ? 0.13 : 0.14)
      makePart(
        character,
        new THREE.BoxGeometry(kind === 'heavy' ? 0.11 : 0.075, 0.22, 0.085),
        kind === 'scientist' ? characterMaterials.labCoat : torsoMaterial,
        [shoulderX, 0.34, 0],
        [0, 0, side * (kind === 'injured' ? 0.2 : 0.08)],
      )
    }

    // Head and face.
    const headY = kind === 'heavy' ? 0.59 : 0.585
    makePart(
      character,
      new THREE.SphereGeometry(kind === 'heavy' ? 0.105 : 0.09, 10, 8),
      kind === 'stealth' ? characterMaterials.hood : characterMaterials.skin,
      [0, headY, 0.015],
    )

    if (kind === 'stealth') {
      makePart(character, new THREE.ConeGeometry(0.145, 0.25, 7), characterMaterials.hood, [0, 0.64, -0.015])
      makePart(character, new THREE.BoxGeometry(0.105, 0.045, 0.075), characterMaterials.skinShadow, [0, 0.555, 0.083])
    } else {
      // Simple facial planes and eyes keep each silhouette readable at small scale.
      makePart(character, new THREE.BoxGeometry(0.052, 0.018, 0.012), characterMaterials.skinShadow, [-0.03, headY + 0.005, 0.095])
      makePart(character, new THREE.BoxGeometry(0.052, 0.018, 0.012), characterMaterials.skinShadow, [0.03, headY + 0.005, 0.095])
    }

    if (kind === 'military') {
      makePart(character, new THREE.SphereGeometry(0.105, 10, 6), characterMaterials.beret, [0, 0.665, 0.005], [0, 0, -0.1])
      makePart(character, new THREE.BoxGeometry(0.12, 0.025, 0.08), characterMaterials.beret, [0, 0.635, 0.02])
    }

    if (kind === 'scientist') {
      // Bald scalp, unmistakable glasses and a white coat.
      makePart(character, new THREE.SphereGeometry(0.092, 10, 8), characterMaterials.skin, [0, 0.61, 0.015])
      for (const side of [-1, 1]) {
        makePart(character, new THREE.BoxGeometry(0.06, 0.045, 0.018), characterMaterials.glasses, [side * 0.033, 0.615, 0.099])
        makePart(character, new THREE.BoxGeometry(0.043, 0.028, 0.008), characterMaterials.lens, [side * 0.033, 0.615, 0.11])
      }
      makePart(character, new THREE.BoxGeometry(0.025, 0.012, 0.015), characterMaterials.glasses, [0, 0.615, 0.104])
    }

    if (kind === 'injured') {
      // A crooked walking stick makes the limp legible even when the figure is tiny.
      makePart(character, new THREE.CylinderGeometry(0.009, 0.009, 0.34, 5), materials.woodLight, [0.18, 0.19, 0.035], [0, 0, -0.12])
      makePart(character, new THREE.BoxGeometry(0.07, 0.025, 0.025), materials.woodLight, [0.18, 0.35, 0.035])
      makePart(character, new THREE.BoxGeometry(0.1, 0.04, 0.07), characterMaterials.skinShadow, [0, 0.47, 0.04], [0, 0, -0.15])
    }

    // Tiny colour accents help the roles read clearly in the isometric view.
    if (kind === 'stealth') {
      makePart(character, new THREE.BoxGeometry(0.045, 0.13, 0.045), characterMaterials.heavyVest, [0.105, 0.34, -0.015], [0, 0, -0.1])
    }

    return character
  }

  // The stealth character takes the first turn; the caller owns active-survivor state.
  let activeCharacter = createCharacter(activeSurvivorKind)
  activeCharacter.position.set(0, 0.19, 0.16)
  activeCharacter.scale.setScalar(0.72)
  start.add(activeCharacter)

  // Character-focused lighting keeps faces, silhouettes and outfit colours readable
  // without lifting the darkness of the unexplored surroundings.
  const characterKeyLight = new THREE.PointLight('#d8f4ff', 3.8, 4.5, 1.6)
  characterKeyLight.position.set(0.05, 1.5, 0.35)
  start.add(characterKeyLight)

  const characterFillLight = new THREE.PointLight('#5ebfe8', 2.2, 3.4, 1.8)
  characterFillLight.position.set(-0.65, 0.75, 0.15)
  start.add(characterFillLight)

  const warmRimLight = new THREE.PointLight('#f0b17a', 1.4, 2.8, 1.8)
  warmRimLight.position.set(0.55, 0.65, -0.45)
  start.add(warmRimLight)

  const activeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.235, 32),
    characterMaterials.activeRing,
  )
  activeRing.rotation.x = -Math.PI / 2
  activeRing.position.set(0, 0.183, 0.16)
  start.add(activeRing)


  const otherCharacters: Array<{ kind: Exclude<SurvivorKind, 'stealth'>; character: THREE.Group; position: [number, number, number] }> = [
    { kind: 'heavy', character: createCharacter('heavy'), position: [-0.32, 0.19, -0.28] },
    { kind: 'military', character: createCharacter('military'), position: [0.32, 0.19, -0.28] },
    { kind: 'scientist', character: createCharacter('scientist'), position: [-0.32, 0.19, 0.36] },
    { kind: 'injured', character: createCharacter('injured'), position: [0.32, 0.19, 0.36] },
  ]

  for (const { character, position } of otherCharacters) {
    character.position.set(...position)
    character.scale.setScalar(0.27)
    start.add(character)
  }

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



  return { root, scene, camera, renderer, materials, board, start, activeCharacter, activeRing, characterKeyLight, characterFillLight, warmRimLight, otherCharacters }
}
