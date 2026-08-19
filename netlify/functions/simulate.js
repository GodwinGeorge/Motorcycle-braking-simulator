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

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ stoppingTime, stoppingDistance, deceleration: -deceleration, actualBrakeForce })
  }
}
