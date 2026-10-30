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
          <div class="pa-canvas-wrap"><div class="pa-grid" role="grid" aria-label="Grille de dessin"></div></div>
          <aside class="pa-tools"><h3>Couleur</h3><div class="pa-palette"></div>
            <label class="pa-custom-label">Couleur personnalisée<input id="pa-custom" type="color" value="#626b6d"></label>
            <div class="pa-tool-actions"><button id="pa-fill" type="button">Remplir</button><button id="pa-clear" type="button">Tout effacer</button></div>
            <p class="pa-help">Chaque modification est enregistrée dans le fichier JSON du modèle. Les modèles déjà dessinés sont chargés directement depuis le projet.</p>
          </aside>
        </div>
      </section>
    </div>
  </main>`
const root = document.querySelector<HTMLElement>('.pixelart-app')!
const nav = root.querySelector<HTMLElement>('.pa-model-list')!
const grid = root.querySelector<HTMLElement>('.pa-grid')!
const paletteElement = root.querySelector<HTMLElement>('.pa-palette')!
const name = root.querySelector<HTMLElement>('#pa-model-name')!
const doorCount = root.querySelector<HTMLElement>('#pa-door-count')!
const dimensions = root.querySelector<HTMLElement>('#pa-dimensions')!
const status = root.querySelector<HTMLElement>('#pa-save-status')!
const colors = ['#171d20','#30383b','#354144','#4b5659','#626b6d','#707875','#858b83','#a4a99e','#c2c2b2','#d0b18a','#76513d','#b47d56','#3f3029','#c0c7bf','#783d3b','#a64c47']
let activeId: CorridorPixelTemplateId = CORRIDOR_PIXEL_MODELS[0].id
let activeColor = colors[4]
let isPainting = false
let saveQueue = Promise.resolve()
const save = (id: CorridorPixelTemplateId) => {
  status.textContent = 'Enregistrement…'
  const pixels = [...templates[id]]
  saveQueue = saveQueue.then(async () => {
    const result = await fetch(`/__corridor-models/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pixels }),
    })
    if (!result.ok) throw new Error(`Échec de l'enregistrement de ${id}.json`)
    status.textContent = `✓ ${id}.json enregistré`
  }).catch((error: unknown) => {
    status.textContent = error instanceof Error ? error.message : 'Erreur d’enregistrement'
  })
}
const renderNav = () => {
  nav.innerHTML = CORRIDOR_PIXEL_MODELS.map((model) => `
    <button type="button" data-model="${model.id}" class="${model.id === activeId ? 'is-active' : ''}">
      <span>${model.label}</span><small>${model.doors} porte${model.doors > 1 ? 's' : ''}</small>
    </button>`).join('')
}
const renderGrid = () => {
  const model = CORRIDOR_PIXEL_MODELS.find((item) => item.id === activeId)!
  const size = getCorridorPixelSize(templates[activeId])
  name.textContent = model.label
  doorCount.textContent = `${model.doors} PORTE${model.doors > 1 ? 'S' : ''}`
  dimensions.textContent = `${size} × ${size} pixels`
  grid.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`
  grid.innerHTML = templates[activeId].map((color, index) =>
    `<button type="button" class="pa-pixel" role="gridcell" data-index="${index}" style="background:${color}" aria-label="Pixel ${index % size + 1}, ${Math.floor(index / size) + 1}"></button>`,
  ).join('')
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
  if (templates[activeId][index] === activeColor) return
  templates[activeId][index] = activeColor
  const pixel = grid.children.item(index) as HTMLElement | null
  if (pixel) pixel.style.backgroundColor = activeColor
  save(activeId)
}
grid.addEventListener('pointerdown', (event) => {
  const pixel = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  if (!pixel) return
  isPainting = true
  paint(Number(pixel.dataset.index))
})
grid.addEventListener('pointerover', (event) => {
  if (!isPainting || (event as PointerEvent).buttons !== 1) return
  const pixel = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  if (pixel) paint(Number(pixel.dataset.index))
})
window.addEventListener('pointerup', () => { isPainting = false })
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
