import './style.css'
import { CORRIDOR_PIXEL_MODELS, CORRIDOR_PIXEL_SIZE, CORRIDOR_PIXEL_STORAGE_KEY, createDefaultCorridorPixels, type CorridorPixelTemplates } from './game/corridor-pixel-templates'

const readTemplates = (): CorridorPixelTemplates => {
  try {
    const raw = localStorage.getItem(CORRIDOR_PIXEL_STORAGE_KEY)
    return raw ? JSON.parse(raw) as CorridorPixelTemplates : {}
  } catch { return {} }
}
const templates = readTemplates()
for (const model of CORRIDOR_PIXEL_MODELS) templates[model.id] ??= createDefaultCorridorPixels(model.id)
const save = () => localStorage.setItem(CORRIDOR_PIXEL_STORAGE_KEY, JSON.stringify(templates))

document.body.className = 'pixelart-page'
document.body.innerHTML = `
  <main class="pixelart-app">
    <header class="pa-header">
      <a class="pa-back" href="/">← Retour au jeu</a>
      <div><span class="pa-eyebrow">THREEZ / OUTIL DE CRÉATION</span><h1>Atelier pixel art</h1><p>Crée les visuels des cartes couloir, pixel par pixel.</p></div>
      <button class="pa-reset" id="pa-reset" type="button">Réinitialiser les modèles</button>
    </header>
    <div class="pa-layout">
      <nav class="pa-model-list" aria-label="Modèles de couloirs"></nav>
      <section class="pa-editor">
        <header class="pa-editor-heading"><div><span id="pa-door-count"></span><h2 id="pa-model-name"></h2></div><span>32 × 32 pixels</span></header>
        <div class="pa-workspace">
          <div class="pa-canvas-wrap"><div class="pa-grid" role="grid" aria-label="Grille de dessin"></div></div>
          <aside class="pa-tools">
            <h3>Couleur</h3><div class="pa-palette"></div>
            <label class="pa-custom-label">Couleur personnalisée<input id="pa-custom" type="color" value="#626b6d"></label>
            <div class="pa-tool-actions"><button id="pa-fill" type="button">Remplir</button><button id="pa-clear" type="button">Tout effacer</button></div>
            <p class="pa-help">Clique sur un pixel pour le colorer. Tu peux aussi maintenir le clic et faire glisser pour dessiner. Les modifications sont sauvegardées automatiquement dans ce navigateur et réutilisées par les cartes du jeu.</p>
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
const colors = ['#171d20','#30383b','#354144','#4b5659','#626b6d','#707875','#858b83','#a4a99e','#c2c2b2','#d0b18a','#76513d','#b47d56','#3f3029','#c0c7bf','#783d3b','#a64c47']
let activeId = CORRIDOR_PIXEL_MODELS[0].id
let activeColor = colors[4]
let isPainting = false

const renderNav = () => {
  nav.innerHTML = CORRIDOR_PIXEL_MODELS.map((model) => `
    <button type="button" data-model="${model.id}" class="${model.id === activeId ? 'is-active' : ''}">
      <span>${model.label}</span><small>${model.doors} porte${model.doors > 1 ? 's' : ''}</small>
    </button>`).join('')
}
const renderGrid = () => {
  const model = CORRIDOR_PIXEL_MODELS.find((item) => item.id === activeId)!
  name.textContent = model.label
  doorCount.textContent = `${model.doors} PORTE${model.doors > 1 ? 'S' : ''}`
  grid.innerHTML = templates[activeId].map((color, index) =>
    `<button type="button" class="pa-pixel" role="gridcell" data-index="${index}" style="background:${color}" aria-label="Pixel ${index % CORRIDOR_PIXEL_SIZE + 1}, ${Math.floor(index / CORRIDOR_PIXEL_SIZE) + 1}"></button>`,
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
  activeId = button.dataset.model!
  renderGrid()
})
const paint = (index: number) => {
  templates[activeId][index] = activeColor
  const pixel = grid.children.item(index) as HTMLElement | null
  if (pixel) pixel.style.backgroundColor = activeColor
  save()
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
  templates[activeId] = Array(CORRIDOR_PIXEL_SIZE ** 2).fill(activeColor)
  save()
  renderGrid()
})
root.querySelector<HTMLButtonElement>('#pa-clear')!.addEventListener('click', () => {
  templates[activeId] = Array(CORRIDOR_PIXEL_SIZE ** 2).fill('#171d20')
  save()
  renderGrid()
})
root.querySelector<HTMLButtonElement>('#pa-reset')!.addEventListener('click', () => {
  for (const model of CORRIDOR_PIXEL_MODELS) templates[model.id] = createDefaultCorridorPixels(model.id)
  save()
  renderGrid()
})
renderGrid()
