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

            g = 9.81
            v0 = speed_kmh / 3.6
            maxF = mu * m * g
            actualF = min(F, maxF)
            if actualF <= 0 or m <= 0:
                raise ValueError('invalid physical parameters')
            decel = actualF / m
            stopping_time = v0 / decel
            stopping_distance = v0 * v0 / (2 * decel)

            result = {
                'stoppingTime': stopping_time,
                'stoppingDistance': stopping_distance,
                'deceleration': -decel,
                'actualBrakeForce': actualF
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
