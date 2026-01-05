#!/bin/bash

# Setup WiFi Fallback Service
# This script installs the systemd service that automatically starts
# the captive portal on boot if WiFi connection fails

echo "Installing WiFi Fallback Service..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Make the scripts executable
echo "Making scripts executable..."
chmod +x "$SCRIPT_DIR/wifi-fallback-check.sh"
chmod +x "$SCRIPT_DIR/disable-captive-portal.sh"

# Update the service file with the correct path
SERVICE_FILE="$SCRIPT_DIR/wifi-fallback.service"
TEMP_SERVICE="/tmp/wifi-fallback.service"

# Replace the placeholder path with actual path
sed "s|/home/pi/raspi-captive-portal|$( cd "$SCRIPT_DIR/.." && pwd )|g" "$SERVICE_FILE" > "$TEMP_SERVICE"

# Copy service file to systemd directory
echo "Installing systemd service..."
sudo cp "$TEMP_SERVICE" /etc/systemd/system/wifi-fallback.service

# Reload systemd daemon
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable the service to run on boot
echo "Enabling wifi-fallback service..."
sudo systemctl enable wifi-fallback.service

# Create log file with proper permissions
echo "Creating log file..."
sudo touch /var/log/wifi-fallback.log
sudo chmod 644 /var/log/wifi-fallback.log

echo ""
echo "✓ WiFi Fallback Service installed successfully!"
echo ""
echo "How it works:"
echo "  - On boot, the service checks if WiFi connection is successful"
echo "  - If WiFi fails, it automatically starts the captive portal (AP mode)"
echo "  - If WiFi succeeds, it ensures captive portal is disabled"
echo ""
echo "Manual commands:"
echo "  Start service now:  sudo systemctl start wifi-fallback"
echo "  Check status:       sudo systemctl status wifi-fallback"
echo "  View logs:          sudo journalctl -u wifi-fallback -f"
echo "  View custom log:    sudo tail -f /var/log/wifi-fallback.log"
echo "  Disable service:    sudo systemctl disable wifi-fallback"
echo ""
