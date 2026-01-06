#!/bin/bash

# Script to disable captive portal after successful WiFi connection
# This stops the access point services and removes DNS/HTTP redirection

echo "Disabling captive portal services..."

# Stop access point and DNS services
echo "Stopping hostapd, dnsmasq, and captive portal web server..."
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq
sudo systemctl stop access-point-server

# Remove iptables NAT rule for HTTP redirection
echo "Removing iptables NAT rules..."
# Remove potential rule for port 3000 (old config)
sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:3000 2>/dev/null || true
# Remove rule for port 8090 (new config)
sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:8090 2>/dev/null || true

# Save iptables changes
echo "Saving iptables configuration..."
sudo netfilter-persistent save

# Reconfigure wlan0 back to normal WiFi client mode
echo "Reconfiguring wlan0 interface to client mode..."
# Remove the static IP configuration from wlan0 in dhcpcd.conf
echo "Removing static IP configuration from /etc/dhcpcd.conf..."
sudo sed -i '/interface wlan0/d' /etc/dhcpcd.conf
sudo sed -i '/static ip_address=192.168.4.1\/24/d' /etc/dhcpcd.conf
sudo sed -i '/nohook wpa_supplicant/d' /etc/dhcpcd.conf

# Remove the static IP configuration from wlan0 interface immediately
sudo ip addr flush dev wlan0 2>/dev/null || true
# Restart dhcpcd to apply normal DHCP client behavior (or stop it if it conflicts with NetworkManager)
# For Bookworm/NetworkManager, we might just want to restart the interface connection
sudo systemctl restart dhcpcd

if command -v docker >/dev/null 2>&1; then
    echo "Starting AdGuard Home container..."
    sudo docker start adguardhome 2>/dev/null || true
fi

echo "Captive portal disabled successfully."
echo "Access point services stopped. Normal network access restored."
echo "Note: Services are still enabled and will restart on boot if WiFi connection fails."
