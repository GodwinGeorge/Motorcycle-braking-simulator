export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const data = req.body || {}
  const mass = Number(data.mass) || 200
  const speed_kmh = Number(data.speed) || 100
  const friction = Number(data.friction) || 0.8
  const brakeForce = Number(data.brakeForce) || 5000
  const reactionTime = Math.min(5, Math.max(0, Number.isFinite(Number(data.reactionTime)) ? Number(data.reactionTime) : 1))
  const dogDistance = Math.min(200, Math.max(1, Number.isFinite(Number(data.dogDistance)) ? Number(data.dogDistance) : 25))
  const bias = Math.min(100, Math.max(0, Number(data.frontBrakeBias) || 70))
  const absEnabled = data.absEnabled !== false
  const v0 = speed_kmh / 3.6
  const g = 9.81
  const cgHeight = 0.62 + ((Number(data.wheelRadius) || 0.31) - 0.31)
  const grip = Math.max(0.05, Math.cos((Number(data.leanAngle) || 0) * Math.PI / 180))
  const requestedFront = brakeForce * bias / 100
  const requestedRear = brakeForce - requestedFront
  let velocity = v0, position = 0, time = 0, acceleration = 0
  let frontForce = 0, rearForce = 0, frontLoad = mass * g / 2, rearLoad = frontLoad
  for (let step = 0; velocity > 0 && step < 30000; step += 1) {
    const transfer = mass * Math.max(0, -acceleration) * cgHeight / 1.4
    frontLoad = mass * g / 2 + transfer
    rearLoad = Math.max(0, mass * g / 2 - transfer)
    frontForce = Math.min(requestedFront, (absEnabled ? 1 : 0.7) * friction * grip * frontLoad)
    rearForce = Math.min(requestedRear, (absEnabled ? 1 : 0.7) * friction * grip * rearLoad)
    const force = frontForce + rearForce
    acceleration = -force / mass
    position += Math.max(0, velocity * 0.01 + 0.5 * acceleration * 0.0001)
    velocity = Math.max(0, velocity + acceleration * 0.01)
    time += 0.01
  }
  const actualBrakeForce = frontForce + rearForce
  const reactionDistance = v0 * reactionTime
  const brakingDeceleration = position > 0 ? (v0 * v0) / (2 * position) : 0
  const dogHit = dogDistance <= position + reactionDistance
  const distanceAfterReaction = Math.max(0, dogDistance - reactionDistance)
  const impactSpeedKmh = dogHit ? Math.sqrt(Math.max(0, v0 * v0 - 2 * brakingDeceleration * distanceAfterReaction)) * 3.6 : 0

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  return res.status(200).json({ stoppingTime: time, stoppingDistance: position, totalStoppingDistance: position + reactionDistance, reactionTime, reactionDistance, dogDistance, dogHit, impactSpeedKmh, deceleration: -(v0 / time), actualBrakeForce, frontBrakeForce: frontForce, rearBrakeForce: rearForce, frontLoad, rearLoad, rearWheelLift: rearLoad <= 1e-6, absActive: absEnabled, model: 'load-transfer-v1' })
}
