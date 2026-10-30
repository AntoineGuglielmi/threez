import { defineConfig } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const modelIds = ['straight-0','straight-1','straight-2','turn-0','turn-1','turn-2','tee-0','tee-1','cross-0'] as const
const modelsDirectory = path.resolve(process.cwd(), 'references/models')

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
      const match = url.pathname.match(/^\/__corridor-models\/([a-z]+-\d)$/)
      if (match && request.method === 'PUT') {
        const id = match[1] as typeof modelIds[number]
        if (!modelIds.includes(id)) { response.statusCode = 404; response.end('Unknown model'); return }
        try {
          let body = ''
          for await (const chunk of request) body += chunk
          const parsed = JSON.parse(body) as { pixels?: unknown }
          if (!Array.isArray(parsed.pixels) || parsed.pixels.length !== 512 ** 2 || !parsed.pixels.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
            response.statusCode = 400
            response.end('Expected 262144 hexadecimal color values (512 × 512)')
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
