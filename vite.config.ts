import { defineConfig } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const modelIds = ['straight-0','straight-1','straight-2','turn-0','turn-1','turn-2','tee-0','tee-1','cross-0'] as const
const modelsDirectory = path.resolve(process.cwd(), 'references/models')

const corridorModelsPlugin = () => ({
  name: 'corridor-model-json-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname === '/__corridor-models' && request.method === 'GET') {
        try {
          const models = await Promise.all(modelIds.map(async (id) => {
            const content = JSON.parse(await readFile(path.join(modelsDirectory, id + '.json'), 'utf8')) as Record<string, string[]>
            return { id, pixels: content[id] }
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
          if (!Array.isArray(parsed.pixels) || ![1024, 4096].includes(parsed.pixels.length) || !parsed.pixels.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
            response.statusCode = 400
            response.end('Expected 1024 or 4096 hexadecimal color values')
            return
          }
          await writeFile(path.join(modelsDirectory, id + '.json'), JSON.stringify({ [id]: parsed.pixels }, null, 4) + '\n', 'utf8')
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
