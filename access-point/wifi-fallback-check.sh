#!/bin/bash

# WiFi Fallback Checker
# This script runs on boot to check if WiFi connection is successful.
# If WiFi fails, it automatically starts the captive portal (AP mode)
# to allow reconfiguration.

LOG_FILE="/var/log/wifi-fallback.log"
MAX_ATTEMPTS=12  # 12 attempts * 5 seconds = 60 seconds total
SLEEP_INTERVAL=5

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | sudo tee -a "$LOG_FILE"
}

check_internet_connectivity() {
    # Try to ping multiple reliable hosts
    if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 || \
       ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1 || \
       ping -c 1 -W 2 9.9.9.9 >/dev/null 2>&1; then
        return 0  # Success
    fi
    return 1  # Failure
}

check_wifi_connection() {
    # Check if any WiFi connection is active (excluding AP mode)
    local connection_state=$(nmcli -t -f STATE general)
    if [ "$connection_state" = "connected" ]; then
        # Verify we have an actual WiFi connection, not just the AP
        local wifi_devices=$(nmcli -t -f DEVICE,TYPE,STATE device | grep "wifi:connected" | grep -v "wlan0")
        if [ -n "$wifi_devices" ]; then
            return 0  # WiFi connected
        fi
    fi
    return 1  # Not connected
}

log_message "=== WiFi Fallback Check Started ==="

# Wait a bit for network services to initialize
sleep 10

# Check WiFi connection status
attempt=0
wifi_connected=false

log_message "Checking WiFi connection status..."

while [ $attempt -lt $MAX_ATTEMPTS ]; do
    attempt=$((attempt + 1))
    log_message "Attempt $attempt/$MAX_ATTEMPTS: Checking connectivity..."
    
    if check_internet_connectivity; then
        log_message "Internet connectivity verified!"
        wifi_connected=true
        break
    fi
    
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        log_message "No connectivity yet, waiting ${SLEEP_INTERVAL}s..."
        sleep $SLEEP_INTERVAL
    fi
done

if [ "$wifi_connected" = true ]; then
    log_message "WiFi connection successful. Captive portal not needed."
    log_message "Ensuring hostapd and dnsmasq are stopped..."
    
    # Make sure AP services are stopped
    sudo systemctl stop hostapd 2>/dev/null || true
    sudo systemctl stop dnsmasq 2>/dev/null || true
    sudo systemctl stop access-point-server 2>/dev/null || true
    
    # Remove iptables NAT rule if it exists
    sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:3000 2>/dev/null || true
    sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:8090 2>/dev/null || true
    sudo netfilter-persistent save 2>/dev/null || true
    
    # Reconfigure wlan0 back to normal WiFi client mode
    log_message "Reconfiguring wlan0 interface to client mode..."
    sudo ip addr flush dev wlan0 2>/dev/null || true
    sudo systemctl restart dhcpcd 2>/dev/null || true
    
    log_message "Captive portal services stopped."
else
    log_message "WiFi connection failed after $MAX_ATTEMPTS attempts."
    log_message "Starting captive portal (AP mode) for reconfiguration..."
    
    # Start AP services
    sudo systemctl start hostapd
    sudo systemctl start dnsmasq
    sudo systemctl start access-point-server
    
    # Ensure iptables NAT rule is in place
    sudo iptables -t nat -C PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:8090 2>/dev/null || \
        sudo iptables -t nat -I PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:8090
    
    sudo netfilter-persistent save
    
    log_message "Captive portal started. Connect to WiFi AP to reconfigure."
fi

log_message "=== WiFi Fallback Check Completed ==="
