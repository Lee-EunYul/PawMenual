import { createServer } from 'node:http'
import handler from './food-recommendation/index.js'
import nearbyHospitals from './nearby-hospitals/index.js'

createServer(async (req, res) => {
  const routes = { '/api/food-recommendation': handler, '/api/nearby-hospitals': nearbyHospitals }
  const routeHandler = Object.hasOwn(routes, req.url) ? routes[req.url] : null
  if (!routeHandler || req.method !== 'POST') {
    res.writeHead(404).end()
    return
  }
  let raw = ''
  try {
    for await (const chunk of req) {
      raw += chunk
      if (Buffer.byteLength(raw) > 8192) {
        res.writeHead(413).end()
        return
      }
    }
    const context = {}
    await routeHandler(context, { body: JSON.parse(raw) })
    res.writeHead(context.res.status, context.res.headers).end(JSON.stringify(context.res.body))
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: '잘못된 요청입니다.' }))
  }
}).listen(Number(process.env.PORT || 7071), '127.0.0.1', () => {
  console.log('Local API: http://127.0.0.1:' + (process.env.PORT || 7071))
})