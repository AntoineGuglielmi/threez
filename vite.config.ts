import { defineConfig } from 'vite'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CORRIDOR_PIXEL_CONFIG } from './src/game/corridor-pixel-config'

const modelIds = ['straight-0','straight-1','straight-2','turn-0','turn-1','turn-2','turn-3','tee-0','tee-1','cross-0','room-0'] as const
const modelsDirectory = path.resolve(process.cwd(), 'references/models')
const gameSavePath = path.resolve(process.cwd(), 'debug/saves/current-game.json')

type CompactModel = { size: number; fill: string } | { size: number; palette: string[]; rows: string[] }

const encodeModel = (pixels: string[]): CompactModel => {
  const size = Math.sqrt(pixels.length)
  const palette = [...new Set(pixels)]
  if (palette.length === 1) return { size, fill: palette[0] }
  const indexes = new Map(palette.map((color, index) => [color, index.toString(36)]))
  const rows = Array.from({ length: size }, (_, y) =>
    pixels.slice(y * size, (y + 1) * size).map((color) => indexes.get(color)!.padStart(2, '0')).join(''),
  )
  return { size, palette, rows }
}

const corridorModelsPlugin = () => ({
  name: 'corridor-model-json-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname === '/__corridor-models' && request.method === 'GET') {
        try {
          const models = await Promise.all(modelIds.map(async (id) => {
            const content = JSON.parse(await readFile(path.join(modelsDirectory, id + '.json'), 'utf8')) as Record<string, unknown>
            return { id, model: content[id] }
          }))
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(models))
        } catch {
          response.statusCode = 500
          response.end('Unable to read corridor model JSON files')
        }
        return
      }
      if (url.pathname === '/__game-state' && request.method === 'GET') {
        try {
          const savedState = await readFile(gameSavePath, 'utf8')
          JSON.parse(savedState)
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(savedState)
        } catch {
          response.statusCode = 404
          response.end('Committed game save not found or invalid')
        }
        return
      }
      if (url.pathname === '/__game-state' && request.method === 'DELETE') {
        try {
          await rm(gameSavePath, { force: true })
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ reset: true }))
        } catch {
          response.statusCode = 500
          response.end('Unable to reset game state')
        }
        return
      }
      if (url.pathname === '/__game-state' && request.method === 'PUT') {
        try {
          let body = ''
          for await (const chunk of request) body += chunk
          const parsed = JSON.parse(body) as { tiles?: unknown; survivor?: unknown; deck?: unknown }
          if (!Array.isArray(parsed.tiles) || typeof parsed.survivor !== 'object' || parsed.survivor === null || !Array.isArray(parsed.deck)) {
            response.statusCode = 400
            response.end('Invalid game state')
            return
          }
          await mkdir(path.dirname(gameSavePath), { recursive: true })
          await writeFile(gameSavePath, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ saved: true, path: 'debug/saves/current-game.json' }))
        } catch {
          response.statusCode = 400
          response.end('Invalid game state JSON')
        }
        return
      }
      const match = url.pathname.match(/^\/__corridor-models\/([a-z]+-\d)$/)
      if (match && request.method === 'PUT') {
        const id = match[1] as typeof modelIds[number]
        if (!modelIds.includes(id)) { response.statusCode = 404; response.end('Unknown model'); return }
        try {
          let body = ''
          for await (const chunk of request) body += chunk
          const parsed = JSON.parse(body) as { pixels?: unknown }
          if (!Array.isArray(parsed.pixels) || parsed.pixels.length !== CORRIDOR_PIXEL_CONFIG.size ** 2 || !parsed.pixels.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
            response.statusCode = 400
            response.end(`Expected ${CORRIDOR_PIXEL_CONFIG.size ** 2} hexadecimal color values (${CORRIDOR_PIXEL_CONFIG.size} × ${CORRIDOR_PIXEL_CONFIG.size})`)
            return
          }
          await writeFile(path.join(modelsDirectory, id + '.json'), JSON.stringify({ [id]: encodeModel(parsed.pixels) }, null, 2) + '\n', 'utf8')
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ saved: id }))
        } catch {
          response.statusCode = 400
          response.end('Invalid model JSON')
        }
        return
      }
      next()
    })
  },
})

export default defineConfig({
  base: './',
  plugins: [corridorModelsPlugin()],
  server: {
    watch: {
      // Editing a model must not trigger a full-page reload in the pixel-art editor.
      ignored: ['**/references/models/**'],
    },
  },
})
