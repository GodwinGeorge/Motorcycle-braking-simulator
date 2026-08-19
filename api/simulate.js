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

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  return res.status(200).json({ stoppingTime, stoppingDistance, deceleration: -deceleration, actualBrakeForce })
}
