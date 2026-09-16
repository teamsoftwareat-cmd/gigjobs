import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'buffer'

// Development-time image proxy middleware to bypass CORS for remote image hosts
// Usage: fetch('/__image_proxy?url=' + encodeURIComponent(remoteUrl))
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-image-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          try {
            if (!req.url) return next()
            if (req.url.startsWith('/__site_proxy')) {
              const incoming = new URL(req.url, 'http://localhost')
              const target = incoming.searchParams.get('url')
              if (!target) {
                res.statusCode = 400
                res.end('Missing url query param')
                return
              }

              const fetchRes = await fetch(target, {
                method: 'GET',
                redirect: 'follow',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                },
              })

              if (!fetchRes.ok) {
                res.statusCode = fetchRes.status
                res.end('Upstream fetch failed')
                return
              }

              const arrayBuffer = await fetchRes.arrayBuffer()
              const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream'
              res.setHeader('Content-Type', contentType)
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(Buffer.from(arrayBuffer))
              return
            }
            if (req.url.startsWith('/__image_proxy')) {
              const incoming = new URL(req.url, 'http://localhost')
              const target = incoming.searchParams.get('url')
              if (!target) {
                res.statusCode = 400
                res.end('Missing url query param')
                return
              }

              // Fetch server-side (Node) to avoid browser CORS restrictions
              const fetchRes = await fetch(target, { redirect: 'follow' })
              if (!fetchRes.ok) {
                res.statusCode = fetchRes.status
                res.end('Upstream fetch failed')
                return
              }

              const arrayBuffer = await fetchRes.arrayBuffer()
              const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream'
              res.setHeader('Content-Type', contentType)
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(Buffer.from(arrayBuffer))
              return
            }
          } catch (err) {
            res.statusCode = 502
            res.end('Image proxy error')
            return
          }
          next()
        })
      }
    }
  ],
  server: { port: 3000 },
  base: '/',
})