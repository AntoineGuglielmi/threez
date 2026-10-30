import './style.css'
import { CORRIDOR_PIXEL_MODELS, CORRIDOR_PIXEL_SIZE, getCorridorPixelSize, type CorridorPixelTemplateId } from './game/corridor-pixel-templates'

type ModelResponse = { id: CorridorPixelTemplateId; pixels: string[] }
const response = await fetch('/__corridor-models')
if (!response.ok) throw new Error('Impossible de charger les modèles JSON.')
const models = await response.json() as ModelResponse[]
const templates = Object.fromEntries(models.map(({ id, pixels }) => [id, pixels])) as Record<CorridorPixelTemplateId, string[]>

document.body.className = 'pixelart-page'
document.body.innerHTML = `
  <main class="pixelart-app">
    <header class="pa-header">
      <a class="pa-back" href="/">← Retour au jeu</a>
      <div><span class="pa-eyebrow">THREEZ / OUTIL DE CRÉATION</span><h1>Atelier pixel art</h1><p>Les dessins sont enregistrés dans references/models.</p></div>
      <span class="pa-save-status" id="pa-save-status">Modèles chargés</span>
    </header>
    <div class="pa-layout">
      <nav class="pa-model-list" aria-label="Modèles de couloirs"></nav>
      <section class="pa-editor">
        <header class="pa-editor-heading"><div><span id="pa-door-count"></span><h2 id="pa-model-name"></h2></div><span id="pa-dimensions"></span></header>
        <div class="pa-workspace">
          <div class="pa-canvas-wrap"><canvas class="pa-grid" width="512" height="512" role="grid" aria-label="Grille de dessin"></canvas></div>
          <aside class="pa-tools"><h3>Couleur</h3><div class="pa-palette"></div>
            <label class="pa-custom-label">Couleur personnalisée<input id="pa-custom" type="color" value="#626b6d"></label>
            <label class="pa-brush-control" for="pa-brush-size">
              <span>Taille du pinceau <output id="pa-brush-value">1 × 1</output></span>
              <input id="pa-brush-size" type="range" min="1" max="9" step="1" value="1">
            </label>
            <div class="pa-tool-actions"><button id="pa-fill" type="button">Remplir</button><button id="pa-clear" type="button">Tout effacer</button></div>
            <p class="pa-help">Chaque modification est enregistrée dans le fichier JSON du modèle. Les modèles déjà dessinés sont chargés directement depuis le projet.</p>
          </aside>
        </div>
      </section>
    </div>
  </main>`
const root = document.querySelector<HTMLElement>('.pixelart-app')!
const nav = root.querySelector<HTMLElement>('.pa-model-list')!
const grid = root.querySelector<HTMLCanvasElement>('.pa-grid')!
const paletteElement = root.querySelector<HTMLElement>('.pa-palette')!
const name = root.querySelector<HTMLElement>('#pa-model-name')!
const doorCount = root.querySelector<HTMLElement>('#pa-door-count')!
const dimensions = root.querySelector<HTMLElement>('#pa-dimensions')!
const status = root.querySelector<HTMLElement>('#pa-save-status')!
const colors = ['#171d20','#30383b','#354144','#4b5659','#626b6d','#707875','#858b83','#a4a99e','#c2c2b2','#d0b18a','#76513d','#b47d56','#3f3029','#c0c7bf','#783d3b','#a64c47']
let activeId: CorridorPixelTemplateId = CORRIDOR_PIXEL_MODELS[0].id
let activeColor = colors[4]
let brushSize = 1
let isPainting = false
const saveTimers = new Map<CorridorPixelTemplateId, ReturnType<typeof setTimeout>>()
let saveQueue = Promise.resolve()
const save = (id: CorridorPixelTemplateId) => {
  window.clearTimeout(saveTimers.get(id))
  status.textContent = 'Modifications en attente…'
  saveTimers.set(id, window.setTimeout(() => {
    saveTimers.delete(id)
    const pixels = [...templates[id]]
    status.textContent = 'Enregistrement…'
    saveQueue = saveQueue.then(async () => {
      const result = await fetch(`/__corridor-models/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pixels }),
      })
      if (!result.ok) throw new Error(`Échec de l'enregistrement de ${id}.json`)
      status.textContent = `✓ ${id}.json enregistré`
    }).catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : 'Erreur d’enregistrement'
    })
  }, 500))
}
const renderNav = () => {
  nav.innerHTML = CORRIDOR_PIXEL_MODELS.map((model) => `
    <button type="button" data-model="${model.id}" class="${model.id === activeId ? 'is-active' : ''}">
      <span>${model.label}</span><small>${model.doors} porte${model.doors > 1 ? 's' : ''}</small>
    </button>`).join('')
}
const renderCanvas = () => {
  const size = getCorridorPixelSize(templates[activeId])
  grid.width = size
  grid.height = size
  const context = grid.getContext('2d')
  if (!context) return
  const image = context.createImageData(size, size)
  templates[activeId].forEach((color, index) => {
    const value = Number.parseInt(color.slice(1), 16)
    const offset = index * 4
    image.data[offset] = (value >> 16) & 255
    image.data[offset + 1] = (value >> 8) & 255
    image.data[offset + 2] = value & 255
    image.data[offset + 3] = 255
  })
  context.putImageData(image, 0, 0)
}
const renderGrid = () => {
  const model = CORRIDOR_PIXEL_MODELS.find((item) => item.id === activeId)!
  const size = getCorridorPixelSize(templates[activeId])
  name.textContent = model.label
  doorCount.textContent = `${model.doors} PORTE${model.doors > 1 ? 'S' : ''}`
  dimensions.textContent = `${size} × ${size} pixels`
  renderCanvas()
  renderNav()
}
paletteElement.innerHTML = colors.map((color) => `<button type="button" data-color="${color}" style="--swatch:${color}" aria-label="Couleur ${color}"></button>`).join('')
paletteElement.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-color]')
  if (!button) return
  activeColor = button.dataset.color!
  paletteElement.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button))
})
nav.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-model]')
  if (!button) return
  activeId = button.dataset.model as CorridorPixelTemplateId
  renderGrid()
})
const paint = (index: number) => {
  const size = getCorridorPixelSize(templates[activeId])
  const centerX = index % size
  const centerY = Math.floor(index / size)
  const start = -Math.floor((brushSize - 1) / 2)
  const end = Math.ceil((brushSize - 1) / 2)
  let changed = false

  for (let offsetY = start; offsetY <= end; offsetY++) {
    for (let offsetX = start; offsetX <= end; offsetX++) {
      const x = centerX + offsetX
      const y = centerY + offsetY
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      const targetIndex = y * size + x
      if (templates[activeId][targetIndex] === activeColor) continue
      templates[activeId][targetIndex] = activeColor
      const context = grid.getContext('2d')
      if (context) {
        context.fillStyle = activeColor
        context.fillRect(x, y, 1, 1)
      }
      changed = true
    }
  }

  if (changed) save(activeId)
}
const getPixelIndex = (event: PointerEvent) => {
  const bounds = grid.getBoundingClientRect()
  const size = getCorridorPixelSize(templates[activeId])
  const x = Math.floor((event.clientX - bounds.left) / bounds.width * size)
  const y = Math.floor((event.clientY - bounds.top) / bounds.height * size)
  if (x < 0 || y < 0 || x >= size || y >= size) return -1
  return y * size + x
}
grid.addEventListener('pointerdown', (event) => {
  isPainting = true
  grid.setPointerCapture(event.pointerId)
  const index = getPixelIndex(event)
  if (index >= 0) paint(index)
})
grid.addEventListener('pointermove', (event) => {
  if (!isPainting || event.buttons !== 1) return
  const index = getPixelIndex(event)
  if (index >= 0) paint(index)
})
grid.addEventListener('pointerup', () => { isPainting = false })
grid.addEventListener('pointercancel', () => { isPainting = false })
const brushInput = root.querySelector<HTMLInputElement>('#pa-brush-size')!
const brushValue = root.querySelector<HTMLOutputElement>('#pa-brush-value')!
brushInput.addEventListener('input', () => {
  brushSize = Number(brushInput.value)
  brushValue.value = `${brushSize} × ${brushSize}`
})
root.querySelector<HTMLInputElement>('#pa-custom')!.addEventListener('input', (event) => {
  activeColor = (event.target as HTMLInputElement).value
  paletteElement.querySelectorAll('button').forEach((item) => item.classList.remove('is-active'))
})
root.querySelector<HTMLButtonElement>('#pa-fill')!.addEventListener('click', () => {
  templates[activeId] = Array(getCorridorPixelSize(templates[activeId]) ** 2).fill(activeColor)
  renderGrid()
  save(activeId)
})
root.querySelector<HTMLButtonElement>('#pa-clear')!.addEventListener('click', () => {
  templates[activeId] = Array(getCorridorPixelSize(templates[activeId]) ** 2).fill('#171d20')
  renderGrid()
  save(activeId)
})
renderGrid()
