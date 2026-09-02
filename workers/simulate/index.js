addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
}

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(request.url)
  if (url.pathname === '/health' && request.method === 'GET') {
    return jsonResponse({
      status: 'ok',
      service: 'vehicle-braking-worker',
      apiVersion: '2',
      capabilities: ['braking-model', 'sensor-telemetry']
    })
  }

  if (url.pathname !== '/simulate' || request.method !== 'POST') {
    return jsonResponse({ error: 'Not found' }, 404)
  }

  let data
  try {
    data = await request.json()
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
  const mass = numberOr(data.mass, 200)
  const speed_kmh = numberOr(data.speed, 100)
  const friction = numberOr(data.friction, 0.8)
  const brakeForce = numberOr(data.brakeForce, 5000)
  const sensorRate = Math.min(Math.max(numberOr(data.sensorRate, 100), 10), 100)
  const sensorNoise = Math.max(numberOr(data.sensorNoise, 0.02), 0)
  const gpsNoise = Math.max(numberOr(data.gpsNoise, 1.5), 0)
  const wheelRadius = Math.max(numberOr(data.wheelRadius, 0.31), 0.1)
  const leanAngle = Math.min(Math.max(numberOr(data.leanAngle, 0), 0), 60)
  const frontBrakeBias = Math.min(Math.max(numberOr(data.frontBrakeBias, 70), 0), 100)
  const absEnabled = data.absEnabled !== false

  if (mass <= 0 || speed_kmh <= 0 || friction <= 0 || brakeForce <= 0) {
    return jsonResponse({ error: 'Mass, speed, friction, and brake force must be greater than zero.' }, 422)
  }

  const g = 9.81
  const v0 = speed_kmh / 3.6
  const leanGrip = Math.max(0.05, Math.cos(leanAngle * Math.PI / 180))
  const maxBrakeForce = friction * mass * g * leanGrip
  const requestedFrontForce = brakeForce * frontBrakeBias / 100
  const requestedRearForce = brakeForce - requestedFrontForce
  let actualFrontForce = requestedFrontForce
  let actualRearForce = requestedRearForce
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const totalForce = actualFrontForce + actualRearForce
    const decelEstimate = totalForce / mass
    const frontShare = Math.min(0.8, Math.max(0.5, 0.5 + decelEstimate * 0.02))
    const frontLimit = maxBrakeForce * frontShare
    const rearLimit = maxBrakeForce * (1 - frontShare)
    actualFrontForce = absEnabled ? Math.min(requestedFrontForce, frontLimit) : requestedFrontForce
    actualRearForce = absEnabled ? Math.min(requestedRearForce, rearLimit) : requestedRearForce
  }
  const actualBrakeForce = Math.min(actualFrontForce + actualRearForce, maxBrakeForce)
  const deceleration = actualBrakeForce / mass

  const stoppingTime = v0 / deceleration
  const stoppingDistance = (v0 * v0) / (2.0 * deceleration)

  const sensors = []
  let gpsLatitude = 51.5074
  let gpsLongitude = -0.1278
  let gpsSpeed = v0
  const sampleInterval = 1 / sensorRate
  const sampleCount = Math.ceil(stoppingTime / sampleInterval)

  // Deterministic noise keeps local and hosted runs repeatable for the same inputs.
  const noise = (seed) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return (value - Math.floor(value) - 0.5) * 2 * sensorNoise
  }

  for (let index = 0; index < sampleCount; index += 1) {
    const time = Math.min((index + 1) * sampleInterval, stoppingTime)
    const velocity = Math.max(v0 - deceleration * time, 0)
    const position = Math.max(v0 * time - 0.5 * deceleration * time * time, 0)
    const brakingRatio = deceleration > 0 ? Math.min(Math.abs(deceleration) / deceleration, 1) : 0
    const gpsSample = index === 0 || Math.floor(time) !== Math.floor(Math.max(0, time - sampleInterval))

    if (gpsSample) {
      const positionNoise = ((noise(index + 1000) / Math.max(sensorNoise, 0.0001)) * gpsNoise)
      gpsLatitude = 51.5074 + positionNoise / 111111
      gpsLongitude = -0.1278 + (position + positionNoise) / 69400
      gpsSpeed = Math.max(0, velocity + noise(index + 2000) * 0.05)
    }

    sensors.push({
      time,
      frontWheelSpeed: Math.max(0, velocity * (1 + 0.12 * brakingRatio * (1 - actualFrontForce / Math.max(requestedFrontForce, 0.001))) / wheelRadius + noise(index + 1)),
      rearWheelSpeed: Math.max(0, velocity * (1 - 0.08 * brakingRatio * (1 - actualRearForce / Math.max(requestedRearForce, 0.001))) / wheelRadius + noise(index + 2)),
      longitudinalAcceleration: -deceleration + noise(index + 3),
      lateralAcceleration: noise(index + 4) * 0.25,
      verticalAcceleration: 9.81 + noise(index + 5) * 0.5,
      rollRate: noise(index + 6) * 0.1,
      pitchRate: -Math.abs(deceleration) * 0.015 + noise(index + 7) * 0.1,
      yawRate: noise(index + 8) * 0.1,
      gpsLatitude,
      gpsLongitude,
      gpsSpeed,
      gpsFix: true
    })
  }

  const result = {
    apiVersion: '2',
    stoppingTime: stoppingTime,
    stoppingDistance: stoppingDistance,
    deceleration: -deceleration,
    maxDeceleration: deceleration,
    actualBrakeForce: actualBrakeForce,
    frontBrakeForce: actualFrontForce,
    rearBrakeForce: actualRearForce,
    absActive: absEnabled && (actualFrontForce < requestedFrontForce || actualRearForce < requestedRearForce),
    model: { leanAngle, frontBrakeBias, absEnabled, loadTransfer: true },
    limits: {
      maxBrakeForce,
      frictionLimited: brakeForce > maxBrakeForce
    },
    input: {
      mass,
      speed: speed_kmh,
      friction,
      brakeForce,
      sensorRate,
      sensorNoise,
      gpsNoise,
      wheelRadius
    },
    sensors
  }

  return jsonResponse(result)
}
