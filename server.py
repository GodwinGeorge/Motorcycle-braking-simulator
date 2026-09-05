#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class SimHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_POST(self):
        if self.path != '/simulate':
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'not found'}).encode())
            return

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'invalid json', 'detail': str(e)}).encode())
            return

        try:
            m = float(data.get('mass', 0))
            speed_kmh = float(data.get('speed', 0))
            mu = float(data.get('friction', 0))
            F = float(data.get('brakeForce', 0))
            bias = min(100.0, max(0.0, float(data.get('frontBrakeBias', 70))))
            abs_enabled = data.get('absEnabled', True) is not False
            wheel_radius = max(0.1, float(data.get('wheelRadius', 0.31)))
            lean_angle = float(data.get('leanAngle', 0))
            reaction_time = min(5.0, max(0.0, float(data.get('reactionTime', 1))))
            dog_distance = min(200.0, max(1.0, float(data.get('dogDistance', 25))))
            dog_enabled = data.get('dogEnabled', True) is not False
            requested_lift = data.get('rearWheelLiftRequested', False) is True
            lift_requested = requested_lift and not abs_enabled

            from math import cos, radians
            g = 9.81
            v0 = speed_kmh / 3.6
            grip = max(0.05, cos(radians(lean_angle)))
            cg_height = 0.62 + wheel_radius - 0.31
            requested_front = F * bias / 100.0
            requested_rear = F - requested_front
            velocity = v0
            position = 0.0
            stopping_time = 0.0
            acceleration = 0.0
            front_load = rear_load = m * g / 2.0
            actual_front = actual_rear = 0.0
            while velocity > 0 and stopping_time < 300:
                for _ in range(8):
                    transfer = m * max(0.0, -acceleration) * cg_height / 1.4
                    front_load = m * g / 2.0 + transfer
                    rear_load = max(0.0, m * g / 2.0 - transfer)
                    lift_force = m * g * 1.4 / (2.0 * cg_height)
                    actual_front = min(mu * grip * front_load, max(requested_front, lift_force)) if lift_requested else min(requested_front, (1.0 if abs_enabled else 0.7) * mu * grip * front_load)
                    actual_rear = 0.0 if lift_requested else min(requested_rear, (1.0 if abs_enabled else 0.7) * mu * grip * rear_load)
                    acceleration = -(actual_front + actual_rear) / m
                position += max(0.0, velocity * 0.01 + 0.5 * acceleration * 0.0001)
                velocity = max(0.0, velocity + acceleration * 0.01)
                stopping_time += 0.01
            actualF = actual_front + actual_rear
            if actualF <= 0 or m <= 0:
                raise ValueError('invalid physical parameters')
            decel = v0 / stopping_time
            reaction_distance = v0 * reaction_time
            braking_deceleration = (v0 * v0) / (2.0 * position) if position > 0 else 0.0
            dog_hit = dog_enabled and dog_distance <= position + reaction_distance
            distance_after_reaction = max(0.0, dog_distance - reaction_distance)
            impact_speed_kmh = (max(0.0, v0 * v0 - 2.0 * braking_deceleration * distance_after_reaction) ** 0.5) * 3.6 if dog_hit else 0.0

            result = {
                'stoppingTime': stopping_time,
                'stoppingDistance': position,
                'totalStoppingDistance': position + reaction_distance,
                'reactionTime': reaction_time,
                'reactionDistance': reaction_distance,
                'dogDistance': dog_distance,
                'dogEnabled': dog_enabled,
                'dogHit': dog_hit,
                'impactSpeedKmh': impact_speed_kmh,
                'rearWheelLiftRequested': lift_requested,
                'rearWheelLiftPreventedByAbs': requested_lift and abs_enabled,
                'deceleration': -decel,
                'actualBrakeForce': actualF,
                'frontBrakeForce': actual_front,
                'rearBrakeForce': actual_rear,
                'frontLoad': front_load,
                'rearLoad': rear_load,
                'rearWheelLift': rear_load <= 1e-6,
                'absActive': abs_enabled,
                'model': 'load-transfer-v1'
            }

            self._set_headers(200)
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'bad params', 'detail': str(e)}).encode())


def run(server_class=HTTPServer, handler_class=SimHandler, port=18080):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Starting simulate server on port {port}...')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()


if __name__ == '__main__':
    run()
