#!/usr/bin/env python3
"""
Captive Portal Web Server for Raspberry Pi WiFi Configuration
Provides a simple web interface for connecting the Raspberry Pi to WiFi networks
"""

import json
import subprocess
import re
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import os
import time
import threading


class CaptivePortalHandler(SimpleHTTPRequestHandler):
    """HTTP request handler with captive portal redirect and WiFi management"""
    
    def __init__(self, *args, **kwargs):
        # Set the directory to serve static files from
        super().__init__(*args, directory='public', **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        
        # API endpoint for WiFi scanning
        if parsed_path.path == '/api/wifi/scan':
            self.handle_wifi_scan()
            return
        
        # API endpoint for connection status
        if parsed_path.path == '/api/wifi/status':
            self.handle_wifi_status()
            return
        
        # Captive portal redirect logic
        # If the request is not for our portal hostname, redirect to it
        host = self.headers.get('Host', '')
        if host and not host.startswith('splines.portal'):
            self.send_response(302)
            self.send_header('Location', 'http://splines.portal')
            self.end_headers()
            return
        
        # Serve static files (index.html, index.js, etc.)
        super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        
        # API endpoint for WiFi connection
        if parsed_path.path == '/api/wifi/connect':
            self.handle_wifi_connect()
            return
        
        # Return 404 for unknown POST endpoints
        self.send_error(404, "Endpoint not found")
    
    def handle_wifi_scan(self):
        """Scan for available WiFi networks and return as JSON"""
        try:
            # Use nmcli to scan for WiFi networks
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            networks = []
            seen_ssids = set()
            
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                
                parts = line.split(':')
                if len(parts) >= 3:
                    ssid = parts[0]
                    signal = parts[1]
                    security = parts[2]
                    
                    # Skip empty SSIDs and duplicates
                    if ssid and ssid not in seen_ssids:
                        seen_ssids.add(ssid)
                        networks.append({
                            'ssid': ssid,
                            'signal': int(signal) if signal.isdigit() else 0,
                            'security': security if security else 'Open'
                        })
            
            # Sort by signal strength
            networks.sort(key=lambda x: x['signal'], reverse=True)
            
            self.send_json_response({'success': True, 'networks': networks})
            
        except subprocess.TimeoutExpired:
            self.send_json_response({'success': False, 'error': 'Scan timeout'}, 500)
        except FileNotFoundError:
            self.send_json_response({'success': False, 'error': 'nmcli not found'}, 500)
        except Exception as e:
            self.send_json_response({'success': False, 'error': str(e)}, 500)
    
    def handle_wifi_status(self):
        """Get current WiFi connection status"""
        try:
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'DEVICE,STATE,CONNECTION', 'device', 'status'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            status = {'connected': False, 'ssid': None}
            
            for line in result.stdout.strip().split('\n'):
                if 'wlan0' in line or 'wifi' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 3 and 'connected' in parts[1].lower():
                        status['connected'] = True
                        status['ssid'] = parts[2] if parts[2] else None
                        break
            
            self.send_json_response(status)
            
        except Exception as e:
            self.send_json_response({'connected': False, 'error': str(e)}, 500)
    
    def handle_wifi_connect(self):
        """Connect to a WiFi network with provided credentials"""
        try:
            # Read POST data
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(post_data)
            
            ssid = data.get('ssid', '').strip()
            password = data.get('password', '').strip()
            
            # Validate input
            if not ssid:
                self.send_json_response({'success': False, 'error': 'SSID is required'}, 400)
                return
            
            # Connect to WiFi network
            # First, try to connect (this will also create a connection profile if needed)
            if password:
                cmd = ['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password]
            else:
                cmd = ['nmcli', 'device', 'wifi', 'connect', ssid]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Connection command succeeded, now verify internet connectivity
                # Start verification in background thread to not block the response
                threading.Thread(
                    target=self.verify_and_disable_portal,
                    args=(ssid,),
                    daemon=True
                ).start()
                
                self.send_json_response({
                    'success': True,
                    'message': f'Successfully connected to {ssid}',
                    'note': 'Verifying internet connection. If successful, captive portal will be disabled automatically.'
                })
            else:
                error_msg = result.stderr.strip() if result.stderr else 'Connection failed'
                self.send_json_response({
                    'success': False,
                    'error': error_msg
                }, 400)
                
        except json.JSONDecodeError:
            self.send_json_response({'success': False, 'error': 'Invalid JSON'}, 400)
        except subprocess.TimeoutExpired:
            self.send_json_response({'success': False, 'error': 'Connection timeout'}, 500)
        except Exception as e:
            self.send_json_response({'success': False, 'error': str(e)}, 500)
    
    def verify_and_disable_portal(self, ssid):
        """Verify internet connectivity and disable captive portal if successful"""
        log_file = '/tmp/captive-portal-verification.log'
        
        def log(message):
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            log_msg = f"[{timestamp}] {message}"
            print(log_msg)
            try:
                with open(log_file, 'a') as f:
                    f.write(log_msg + '\n')
            except Exception:
                pass
        
        log(f"[INFO] Verifying internet connectivity for {ssid}...")
        
        # Wait a few seconds for connection to stabilize
        time.sleep(5)
        
        # Try to verify internet connectivity
        max_attempts = 6
        for attempt in range(1, max_attempts + 1):
            log(f"[INFO] Connectivity check attempt {attempt}/{max_attempts}")
            
            if self.check_internet_connectivity():
                log(f"[SUCCESS] Internet connectivity verified!")
                log(f"[INFO] Disabling captive portal...")
                
                # Run the cleanup script to disable captive portal
                # Use absolute path construction for robustness
                script_path = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'access-point',
                    'disable-captive-portal.sh'
                )
                
                log(f"[INFO] Running cleanup script: {script_path}")
                
                try:
                    result = subprocess.run(
                        ['sudo', 'bash', script_path],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if result.returncode == 0:
                        log("[SUCCESS] Captive portal disabled successfully!")
                        log("[INFO] Normal network access restored.")
                        if result.stdout:
                            log(f"[INFO] Script output: {result.stdout.strip()}")
                    else:
                        log(f"[ERROR] Failed to disable captive portal (exit code {result.returncode})")
                        if result.stderr:
                            log(f"[ERROR] Script error: {result.stderr.strip()}")
                        
                except Exception as e:
                    log(f"[ERROR] Exception while disabling portal: {e}")
                
                return
            
            if attempt < max_attempts:
                time.sleep(5)
        
        log(f"[WARNING] Internet connectivity not verified after {max_attempts} attempts.")
        log(f"[WARNING] Captive portal remains active. WiFi may not have internet access.")
        print("[INFO] Captive portal will remain active.")
    
    def check_internet_connectivity(self):
        """Check if internet is accessible by pinging reliable DNS servers"""
        dns_servers = ['8.8.8.8', '1.1.1.1', '9.9.9.9']
        
        for dns in dns_servers:
            try:
                result = subprocess.run(
                    ['ping', '-c', '1', '-W', '2', dns],
                    capture_output=True,
                    timeout=3
                )
                if result.returncode == 0:
                    return True
            except:
                continue
        
        return False
    
    def send_json_response(self, data, status=200):
        """Send a JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override to customize logging"""
        print(f"[{self.log_date_time_string()}] {format % args}")


def run_server(port=3000):
    """Start the HTTP server"""
    # Change to the script's directory so relative paths work
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    server_address = ('', port)
    httpd = HTTPServer(server_address, CaptivePortalHandler)
    
    print(f"Captive Portal Server running on port {port}")
    print(f"Access at: http://splines.portal (or http://192.168.4.1:{port})")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()


if __name__ == '__main__':
    run_server()
