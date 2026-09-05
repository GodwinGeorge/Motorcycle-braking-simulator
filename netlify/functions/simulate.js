exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let data
  try {
    data = JSON.parse(event.body)
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const mass = Number(data.mass) || 200
  const speed_kmh = Number(data.speed) || 100
  const friction = Number(data.friction) || 0.8
  const brakeForce = Number(data.brakeForce) || 5000
  const reactionTime = Math.min(5, Math.max(0, Number.isFinite(Number(data.reactionTime)) ? Number(data.reactionTime) : 1))
  const dogDistance = Math.min(200, Math.max(1, Number.isFinite(Number(data.dogDistance)) ? Number(data.dogDistance) : 25))

  const g = 9.81
  const v0 = speed_kmh / 3.6
  const bias = Math.min(100, Math.max(0, Number(data.frontBrakeBias) || 70))
  const absEnabled = data.absEnabled !== false
  const cgHeight = 0.62 + ((Number(data.wheelRadius) || 0.31) - 0.31)
  const grip = Math.max(0.05, Math.cos((Number(data.leanAngle) || 0) * Math.PI / 180))
  const requestedFront = brakeForce * bias / 100
  const requestedRear = brakeForce - requestedFront
  let velocity = v0, position = 0, stoppingTime = 0, acceleration = 0
  let frontLoad = mass * g / 2, rearLoad = frontLoad, frontForce = 0, rearForce = 0
  for (let step = 0; velocity > 0 && step < 30000; step += 1) {
    const transfer = mass * Math.max(0, -acceleration) * cgHeight / 1.4
    frontLoad = mass * g / 2 + transfer
    rearLoad = Math.max(0, mass * g / 2 - transfer)
    frontForce = Math.min(requestedFront, (absEnabled ? 1 : 0.7) * friction * grip * frontLoad)
    rearForce = Math.min(requestedRear, (absEnabled ? 1 : 0.7) * friction * grip * rearLoad)
    acceleration = -(frontForce + rearForce) / mass
    position += Math.max(0, velocity * 0.01 + 0.5 * acceleration * 0.0001)
    velocity = Math.max(0, velocity + acceleration * 0.01)
    stoppingTime += 0.01
  }
  const actualBrakeForce = frontForce + rearForce
  const reactionDistance = v0 * reactionTime
  const brakingDeceleration = position > 0 ? (v0 * v0) / (2 * position) : 0
  const dogHit = dogDistance <= position + reactionDistance
  const distanceAfterReaction = Math.max(0, dogDistance - reactionDistance)
  const impactSpeedKmh = dogHit ? Math.sqrt(Math.max(0, v0 * v0 - 2 * brakingDeceleration * distanceAfterReaction)) * 3.6 : 0

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ stoppingTime, stoppingDistance: position, totalStoppingDistance: position + reactionDistance, reactionTime, reactionDistance, dogDistance, dogHit, impactSpeedKmh, deceleration: -(v0 / stoppingTime), actualBrakeForce, frontBrakeForce: frontForce, rearBrakeForce: rearForce, frontLoad, rearLoad, rearWheelLift: rearLoad <= 1e-6, absActive: absEnabled, model: 'load-transfer-v1' })
  }
}
