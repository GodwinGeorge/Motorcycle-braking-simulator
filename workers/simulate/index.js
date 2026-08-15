addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(request.url)
  if (url.pathname !== '/simulate' || request.method !== 'POST') {
    return new Response('Not found', { status: 404 })
  }

  let data
  try {
    data = await request.json()
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 })
  }

  const mass = Number(data.mass) || 1500
  const speed_kmh = Number(data.speed) || 100
  const friction = Number(data.friction) || 0.8
  const brakeForce = Number(data.brakeForce) || 15000

  const g = 9.81
  const v0 = speed_kmh / 3.6
  const maxBrakeForce = friction * mass * g
  const actualBrakeForce = Math.min(brakeForce, maxBrakeForce)
  const deceleration = actualBrakeForce / mass

  const stoppingTime = v0 / deceleration
  const stoppingDistance = (v0 * v0) / (2.0 * deceleration)

  const result = {
    stoppingTime: stoppingTime,
    stoppingDistance: stoppingDistance,
    deceleration: -deceleration,
    actualBrakeForce: actualBrakeForce
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS)
  })
}
