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
  const referenceRadius = 0.31
  const referenceCgHeight = 0.62
  const cgHeight = referenceCgHeight + (wheelRadius - referenceRadius)
  const leanLimit = Math.atan(referenceCgHeight / cgHeight) * 180 / Math.PI
  const fallen = leanAngle > leanLimit

  if (mass <= 0 || speed_kmh <= 0 || friction <= 0 || brakeForce <= 0) {
    return jsonResponse({ error: 'Mass, speed, friction, and brake force must be greater than zero.' }, 422)
  }

  const g = 9.81
  const v0 = speed_kmh / 3.6
  const dt = 0.01
  const wheelMass = mass * 0.04
  const referenceWheelInertia = 0.5 * wheelMass * referenceRadius ** 2
  const effectiveMass = mass + (2 * referenceWheelInertia) / wheelRadius ** 2
  const leanGrip = Math.max(0.05, Math.cos(leanAngle * Math.PI / 180))
  const maxBrakeForce = friction * mass * g * leanGrip
  const requestedFrontForce = brakeForce * frontBrakeBias / 100
  const requestedRearForce = brakeForce - requestedFrontForce
  const sensors = []
  const trajectory = [{ time: 0, velocity: v0, position: 0, acceleration: 0 }]
  const sampleInterval = 1 / sensorRate
  const sensorStep = Math.max(1, Math.round(sampleInterval / dt))
  const gpsStep = Math.round(1 / dt)
  let velocity = v0
  let position = 0
  let time = 0
  let previousAcceleration = 0
  let fusedSpeed = v0
  let gpsLatitude = 51.5074
  let gpsLongitude = -0.1278
  let gpsSpeed = v0
  let frontWheelSpeed = v0 / wheelRadius
  let rearWheelSpeed = v0 / wheelRadius
  let actualFrontForce = 0
  let actualRearForce = 0
  let absActive = false

  // Deterministic noise makes local and hosted runs repeatable for the same inputs.
  const noise = (seed, amplitude = sensorNoise) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return (value - Math.floor(value) - 0.5) * 2 * amplitude
  }
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

  for (let step = 0; velocity > 0 && step < 30000; step += 1) {
    let forceAcceleration = previousAcceleration
    let frontLoad = mass * g / 2
    let rearLoad = frontLoad
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const transfer = mass * Math.max(0, -forceAcceleration) * cgHeight / 1.4
      frontLoad = mass * g / 2 + transfer
      rearLoad = Math.max(0, mass * g / 2 - transfer)
      const frontLimit = friction * leanGrip * frontLoad
      const rearLimit = friction * leanGrip * rearLoad
      actualFrontForce = Math.min(requestedFrontForce, absEnabled ? frontLimit : frontLimit * 0.7)
      actualRearForce = Math.min(requestedRearForce, absEnabled ? rearLimit : rearLimit * 0.7)
      forceAcceleration = -(actualFrontForce + actualRearForce) / mass
    }
    absActive = absActive || (absEnabled && (actualFrontForce < requestedFrontForce || actualRearForce < requestedRearForce))
    const actualBrakeForce = actualFrontForce + actualRearForce
    const acceleration = -actualBrakeForce / mass

    position += Math.max(0, velocity * dt + 0.5 * acceleration * dt * dt)
    velocity = Math.max(0, velocity + acceleration * dt)
    time += dt
    previousAcceleration = acceleration
    trajectory.push({ time, velocity, position, acceleration })

    const rearWheelLift = rearLoad <= 1e-6
    const finalFrontLimit = friction * leanGrip * frontLoad
    const finalRearLimit = friction * leanGrip * rearLoad
    const frontSlip = requestedFrontForce > finalFrontLimit ? clamp((requestedFrontForce - finalFrontLimit) / requestedFrontForce, 0, 0.25) : 0
    const rearSlip = requestedRearForce > finalRearLimit ? clamp((requestedRearForce - finalRearLimit) / requestedRearForce, 0, 0.25) : 0
    frontWheelSpeed = Math.max(0, velocity * (1 - frontSlip) / wheelRadius + noise(step + 1))
    rearWheelSpeed = Math.max(0, velocity * (1 - rearSlip) / wheelRadius + noise(step + 2))
    const imuAcceleration = acceleration + noise(step + 3)
    fusedSpeed = Math.max(0, fusedSpeed + imuAcceleration * dt)
    if (step % gpsStep === 0) {
      const positionNoise = noise(step + 1000, gpsNoise)
      gpsLatitude = 51.5074 + positionNoise / 111111
      gpsLongitude = -0.1278 + (position + positionNoise) / 69400
      gpsSpeed = Math.max(0, velocity + noise(step + 2000, gpsNoise) * 0.05)
      fusedSpeed = 0.85 * fusedSpeed + 0.15 * gpsSpeed
    }
    if (step % sensorStep === 0 || sensors.length === 0) {
      sensors.push({
        time,
        frontWheelSpeed,
        rearWheelSpeed,
        longitudinalAcceleration: imuAcceleration,
        lateralAcceleration: noise(step + 4) * 0.25,
        verticalAcceleration: g + noise(step + 5) * 0.5,
        rollRate: noise(step + 6) * 0.1,
        pitchRate: -Math.abs(acceleration) * 0.015 + noise(step + 7) * 0.1,
        yawRate: noise(step + 8) * 0.1,
        gpsLatitude,
        gpsLongitude,
        gpsSpeed,
        gpsFix: true
      })
    }
  }

  const actualBrakeForce = actualFrontForce + actualRearForce
  const reactionTime = 1
  const reactionDistance = v0 * reactionTime
  const rearWheelLift = mass * g / 2 - mass * Math.max(0, -previousAcceleration) * cgHeight / 1.4 <= 1e-6
  const deceleration = time > 0 ? v0 / time : 0
  const averageDeceleration = position > 0 ? (v0 * v0) / (2 * position) : 0

  const result = {
    apiVersion: '2',
    stoppingTime: time,
    stoppingDistance: position,
    totalStoppingDistance: position + reactionDistance,
    reactionTime,
    reactionDistance,
    deceleration: -averageDeceleration,
    maxDeceleration: averageDeceleration,
    actualBrakeForce: actualBrakeForce,
    frontBrakeForce: actualFrontForce,
    rearBrakeForce: actualRearForce,
    rearWheelLift,
    absActive: absEnabled && absActive,
    model: { leanAngle, frontBrakeBias, absEnabled, loadTransfer: true, sensorFusion: true, cgHeight, leanLimit, effectiveMass },
    fallen,
    leanLimit,
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
      wheelRadius,
      leanAngle,
      frontBrakeBias,
      absEnabled
    },
    sensors,
    trajectory
  }

  return jsonResponse(result)
}
