# WiFi Fallback and Auto-disable Captive Portal

## Overview

This enhancement ensures that after successfully connecting to WiFi, the captive portal is automatically disabled, allowing normal network access. Additionally, it implements a fallback mechanism that automatically restarts the captive portal on boot if the WiFi connection fails.

## How It Works

### 1. **After Successful WiFi Connection**

When you connect to a WiFi network through the captive portal:

1. The server attempts to connect using `nmcli`
2. If connection succeeds, a background verification process starts
3. The system pings reliable DNS servers (8.8.8.8, 1.1.1.1, 9.9.9.9) to verify internet connectivity
4. If internet is confirmed (within ~30 seconds), the captive portal automatically disables itself:
   - Stops `hostapd` service (access point)
   - Stops `dnsmasq` service (DNS redirection)
   - Removes iptables NAT rules (HTTP redirection)
5. Normal network access is restored - you can now access AdGuard at `ip:3000` or any other services

### 2. **Boot-time WiFi Fallback**

On every boot, the system checks WiFi connectivity:

1. The `wifi-fallback` service runs automatically after network initialization
2. It waits up to 60 seconds checking for internet connectivity
3. **If WiFi connection works**: Ensures captive portal stays disabled
4. **If WiFi connection fails**: Automatically starts the captive portal (AP mode) so you can reconfigure

This means you'll never be locked out - if WiFi credentials are wrong or the network is unavailable, the Raspberry Pi will automatically create its own access point for reconfiguration.

## Files Added

### Scripts

- **`access-point/disable-captive-portal.sh`**: Script to disable captive portal services and remove redirects
- **`access-point/wifi-fallback-check.sh`**: Boot-time script that checks WiFi and starts AP if needed
- **`access-point/setup-wifi-fallback.sh`**: Installation script for the fallback service

### Service

- **`access-point/wifi-fallback.service`**: Systemd service that runs the fallback checker on boot

### Modified Files

- **`server/server.py`**: Added internet connectivity verification and automatic portal disabling
- **`server/public/index.js`**: Enhanced UI messages to inform users about portal shutdown

## Installation

### 1. Make Scripts Executable

```bash
cd ~/raspi-captive-portal/access-point
chmod +x disable-captive-portal.sh
chmod +x wifi-fallback-check.sh
chmod +x setup-wifi-fallback.sh
```

### 2. Install the WiFi Fallback Service

```bash
sudo ./setup-wifi-fallback.sh
```

This will:
- Install the systemd service
- Enable it to run on boot
- Create necessary log files
- Configure proper permissions

### 3. Restart the Server Service

If your captive portal server is running as a service, restart it to pick up the changes:

```bash
sudo systemctl restart access-point-server
```

Or if running manually:
```bash
cd ~/raspi-captive-portal/server
sudo python3 server.py
```

## Usage

### Normal Operation

1. **Connect to WiFi via Captive Portal**:
   - Connect to the Raspberry Pi's access point
   - Open browser to `http://splines.portal`
   - Select your WiFi network and enter credentials
   - Click "Connect"

2. **Automatic Portal Shutdown**:
   - Wait ~5-30 seconds while connection is verified
   - Portal will automatically disable itself if internet connectivity is confirmed
   - You'll see messages in the browser indicating this process

3. **Access Normal Services**:
   - Once portal is disabled, you can access AdGuard at `<raspberry-pi-ip>:3000`
   - All other network services work normally
   - No more redirects to `splines.portal`

### Boot Behavior

- **Scenario A - WiFi Works**: Portal stays disabled, normal operation continues
- **Scenario B - WiFi Fails**: Portal automatically starts, you can reconnect via access point

### Manual Commands

If you need manual control:

```bash
# Manually disable captive portal
sudo bash ~/raspi-captive-portal/access-point/disable-captive-portal.sh

# Manually enable captive portal (for testing)
sudo systemctl start hostapd
sudo systemctl start dnsmasq

# Check WiFi fallback service status
sudo systemctl status wifi-fallback

# View WiFi fallback logs
sudo journalctl -u wifi-fallback -f
# or
sudo tail -f /var/log/wifi-fallback.log

# Trigger WiFi fallback check manually
sudo systemctl start wifi-fallback
```

## Troubleshooting

### Portal doesn't auto-disable after WiFi connection

1. Check server logs:
   ```bash
   sudo journalctl -u access-point-server -f
   ```

2. Verify internet connectivity manually:
   ```bash
   ping -c 3 8.8.8.8
   ```

3. Check if script has execute permissions:
   ```bash
   ls -l ~/raspi-captive-portal/access-point/disable-captive-portal.sh
   ```

4. Manually run the disable script:
   ```bash
   sudo bash ~/raspi-captive-portal/access-point/disable-captive-portal.sh
   ```

### Portal doesn't start on boot when WiFi fails

1. Check if service is enabled:
   ```bash
   sudo systemctl is-enabled wifi-fallback
   ```

2. View service status:
   ```bash
   sudo systemctl status wifi-fallback
   ```

3. Check logs:
   ```bash
   sudo cat /var/log/wifi-fallback.log
   ```

4. Manually trigger the fallback check:
   ```bash
   sudo systemctl start wifi-fallback
   ```

### Still getting redirected to splines.portal

This might happen if portal didn't fully disable. Manually disable it:

```bash
# Stop services
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq

# Remove iptables rule
sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:3000

# Save changes
sudo netfilter-persistent save
```

## Technical Details

### Internet Connectivity Verification

The system uses a multi-layered approach:

1. Tries to ping 3 different DNS servers (Google, Cloudflare, Quad9)
2. Makes 6 attempts over 30 seconds
3. Only disables portal if at least one ping succeeds
4. Runs in background thread to not block user response

### Fallback Service Timing

- Waits 10 seconds after boot for network initialization
- Checks connectivity 12 times with 5-second intervals
- Total wait time: ~70 seconds before giving up
- If no connectivity, starts AP mode for reconfiguration

### Security Considerations

- Scripts require `sudo` to modify system services
- Server must have permission to run `sudo` commands without password for these specific scripts
- Consider adding this to `/etc/sudoers`:
  ```
  www-data ALL=(ALL) NOPASSWD: /bin/systemctl stop hostapd, /bin/systemctl stop dnsmasq, /sbin/iptables, /usr/sbin/netfilter-persistent
  ```
  (Replace `www-data` with the user running your server)

## Configuration

### Adjust Timeout Values

Edit `server/server.py`:
```python
# In verify_and_disable_portal method
time.sleep(5)  # Initial stabilization delay
max_attempts = 6  # Number of connectivity checks
# ...
time.sleep(5)  # Delay between attempts
```

Edit `access-point/wifi-fallback-check.sh`:
```bash
MAX_ATTEMPTS=12  # Number of boot-time checks
SLEEP_INTERVAL=5  # Seconds between checks
```

### Change DNS Servers for Connectivity Check

Edit both `server/server.py` and `access-point/wifi-fallback-check.sh` to use different DNS servers if needed.

## FAQ

**Q: Will the portal restart if I reboot while connected to WiFi?**  
A: No. If WiFi connection works on boot, the portal stays disabled.

**Q: What happens if WiFi credentials change?**  
A: On next boot, connection will fail and portal will automatically start for reconfiguration.

**Q: Can I permanently disable the fallback mechanism?**  
A: Yes: `sudo systemctl disable wifi-fallback`

**Q: Does this work with static IP configurations?**  
A: Yes, as long as the Raspberry Pi has internet connectivity, the verification will succeed.

**Q: How long does it take for the portal to disable?**  
A: Typically 5-30 seconds after successful WiFi connection, depending on network response time.
