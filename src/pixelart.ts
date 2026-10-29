import './style.css'

type Template = { pixels: string[] }
const SIZE = 32
const STORAGE_KEY = 'threez:corridor-pixel-templates:v1'
const palette = ['#171d20','#626b6d','#858b83','#4b5659','#a4a99e','#c2c2b2','#626d6c','#354144','#d0b18a','#76513d','#b47d56','#3f3029','#c0c7bf','#783d3b','#d4c9a9']
const definitions = [
  { id: 'straight-0', title: 'Droit', doors: 0 },
  { id: 'straight-1', title: 'Droit', doors: 1 },
  { id: 'straight-2', title: 'Droit', doors: 2 },
  { id: 'turn-0', title: 'Virage', doors: 0 },
  { id: 'turn-1', title: 'Virage', doors: 1 },
  { id: 'turn-2', title: 'Virage', doors: 2 },
  { id: 'tee-0', title: 'T', doors: 0 },
  { id: 'tee-1', title: 'T', doors: 1 },
  { id: 'cross-0', title: 'X', doors: 0 },
] as const

const seed = (id: string): string[] => {
  const pixels = Array(SIZE * SIZE).fill('#171d20')
  const [kind] = id.split('-')
  const paint = (x: number, y: number, color: string) => { if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) pixels[y * SIZE + x] = color }
  const rect = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) paint(x,y,color)
  }
  const arms: Array<[number,number,number,number]> = [[9,9,22,22]]
  if (kind === 'straight' || kind === 'tee' || kind === 'cross') arms.push([13,0,18,31])
  if (kind === 'turn') arms.push([0,13,18,18])
  if (kind === 'tee' || kind === 'cross') arms.push([0,13,31,18])
  for (const [x1,y1,x2,y2] of arms) rect(x1,y1,x2,y2,'#626b6d')
  // Subtle floor variation makes the template immediately editable rather than empty.
  for (let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) if(pixels[y*SIZE+x]==='#626b6d' && (x+y)%7===0) paint(x,y,'#858b83')
  return pixels
}
const load = (): Record<string, Template> => {
  try { const value = localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) as Record<string,Template> : {} } catch { return {} }
}
const templates = load()
for (const item of definitions) templates[item.id] ??= { pixels: seed(item.id) }
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))

const root = document.querySelector<HTMLElement>('#pixelart')
if (!root) throw new Error('Pixel art root missing')
root.innerHTML = `
  <header class="pa-header"><a href="/">← Retour au jeu</a><div><span>THREEZ / OUTIL INTERNE</span><h1>Éditeur de couloirs</h1><p>Chaque modèle est réutilisé par les cartes en jeu.</p></div><button id="pa-reset" type="button">Réinitialiser les modèles</button></header>
  <main class="pa-layout"><nav class="pa-models" aria-label="Modèles de couloirs"></nav><section class="pa-editor"><div class="pa-editor-heading"><div><span id="pa-kicker"></span><h2 id="pa-title"></h2></div><span id="pa-count"></span></div><div class="pa-workspace"><div id="pa-grid" class="pa-grid" role="grid" aria-label="Grille de pixels"></div><aside class="pa-tools"><h3>Palette</h3><div id="pa-palette" class="pa-palette"></div><label>Couleur personnalisée<input id="pa-custom" type="color" value="#626b6d"></label><button id="pa-clear" type="button">Effacer la grille</button><p>Peins en cliquant ou en glissant sur les pixels. Les changements sont enregistrés automatiquement.</p></aside></div></section></main>
`

let activeId = definitions[0].id
let activeColor = palette[1]
let painting = false
const nav = root.querySelector<HTMLElement>('.pa-models')!
const grid = root.querySelector<HTMLElement>('#pa-grid')!
const title = root.querySelector<HTMLElement>('#pa-title')!
const kicker = root.querySelector<HTMLElement>('#pa-kicker')!
const count = root.querySelector<HTMLElement>('#pa-count')!
const paletteElement = root.querySelector<HTMLElement>('#pa-palette')!

const renderNav = () => {
  nav.innerHTML = definitions.map(item => `<button type="button" data-id="${item.id}" class="${item.id===activeId?'is-active':''}"><span>${item.title}</span><small>${item.doors} porte(s)</small></button>`).join('')
}
const renderGrid = () => {
  const item = definitions.find(entry => entry.id===activeId)!
  const pixels = templates[activeId].pixels
  kicker.textContent = item.doors + ' PORTE(S)'
  title.textContent = item.title
  count.textContent = SIZE + ' × ' + SIZE + ' pixels'
  grid.innerHTML = pixels.map((color,index)=>`<button type="button" class="pa-pixel" data-index="${index}" style="background:${color}" aria-label="Pixel ${index%SIZE+1}, ${Math.floor(index/SIZE)+1}"></button>`).join('')
  renderNav()
}
const paint = (index:number) => {
  templates[activeId].pixels[index]=activeColor
  const pixel=grid.children.item(index) as HTMLElement|null
  if(pixel) pixel.style.background=activeColor
  save()
}
paletteElement.innerHTML = palette.map(color=>`<button type="button" data-color="${color}" style="--swatch:${color}" aria-label="Couleur ${color}"></button>`).join('')

nav.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-id]')
  if(!button)return
  activeId=button.dataset.id!
  renderGrid()
})
paletteElement.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-color]')
  if(!button)return
  activeColor=button.dataset.color!
  root.querySelectorAll('[data-color]').forEach(el=>el.classList.toggle('is-active',el===button))
})
grid.addEventListener('pointerdown',event=>{
  const pixel=(event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  if(!pixel)return
  painting=true
  ;(event.target as HTMLElement).setPointerCapture?.((event as PointerEvent).pointerId)
  paint(Number(pixel.dataset.index))
})
grid.addEventListener('pointerover',event=>{
  if(!painting || (event as PointerEvent).buttons!==1)return
  const pixel=(event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  if(pixel)paint(Number(pixel.dataset.index))
})
window.addEventListener('pointerup',()=>{painting=false})
root.querySelector<HTMLInputElement>('#pa-custom')!.addEventListener('input',event=>{activeColor=(event.target as HTMLInputElement).value})
root.querySelector<HTMLButtonElement>('#pa-clear')!.addEventListener('click',()=>{
  templates[activeId].pixels=Array(SIZE*SIZE).fill('#171d20')
  save();renderGrid()
})
root.querySelector<HTMLButtonElement>('#pa-reset')!.addEventListener('click',()=>{
  for(const item of definitions)templates[item.id]={pixels:seed(item.id)}
  save();renderGrid()
})
renderGrid()
