#!/bin/bash

# Script to disable captive portal after successful WiFi connection
# This stops the access point services and removes DNS/HTTP redirection

echo "Disabling captive portal services..."

# Stop access point and DNS services
echo "Stopping hostapd and dnsmasq services..."
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq

# Remove iptables NAT rule for HTTP redirection
echo "Removing iptables NAT rules..."
sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:3000 2>/dev/null || true

# Save iptables changes
echo "Saving iptables configuration..."
sudo netfilter-persistent save

# Reconfigure wlan0 back to normal WiFi client mode
echo "Reconfiguring wlan0 interface to client mode..."
# Remove the static IP configuration from wlan0
sudo ip addr flush dev wlan0 2>/dev/null || true
# Restart dhcpcd to apply normal DHCP client behavior
sudo systemctl restart dhcpcd

echo "Captive portal disabled successfully."
echo "Access point services stopped. Normal network access restored."
echo "Note: Services are still enabled and will restart on boot if WiFi connection fails."
