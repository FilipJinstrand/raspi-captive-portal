<p align="center">
  <img src="https://user-images.githubusercontent.com/37160523/164785388-abe36954-6b33-4b1d-a001-46072f68cb99.svg" width="1000px" />
  
  <h3 align="center">Raspi Captive Portal</h3>
  <p align="center">A Captive Portal & Access Point setup for use with the Raspberry Pi</p>
  <p align="center">Tested on the Raspberry Pi 4, Raspberry Pi OS: Bullseye (11) & Bookworm (12) (64-bit)</p>
</p>


## Motivation

Ever connected to a WiFi network in public space? You've probably been redirected to a page where you had to agree to the terms of use to gain access to the Internet. This web page is called *Captive Portal*.

[This Raspi documentation](https://www.raspberrypi.com/documentation/computers/configuration.html#setting-up-a-routed-wireless-access-point) offers a starting point to set up a captive portal on your own. However, it's tedious. And it's a lot of digging through documentation to figure out how to populate those config files properly. And then things don't work as expected and suddenly you've spent another three hours (more!) trying to get a basic access point to run. Why not make your life easier?

| :star:   | If this project indeed made your life easier, consider giving a GitHub star. |
|---------------|:-------------------------|

## What you get

**This repo offers you a complete setup for an access point with a captive portal that allows WiFi configuration.** When users connect to the Raspberry Pi's WiFi network, they are presented with a web interface where they can scan for available WiFi networks and connect the Raspberry Pi to their chosen network by entering the password.

Key features:
- **Access Point**: Raspberry Pi creates its own WiFi network that others can connect to
- **WiFi Configuration Interface**: Users can scan for WiFi networks, see signal strength and security status, and connect the Raspberry Pi to any network
- **Python-based**: Lightweight server using only Python standard library - no Node.js required
- **Captive Portal**: Automatic redirect to configuration page when users connect

You probably want to use this repo in one of these ways:

- As a WiFi configuration tool for your Raspberry Pi in headless mode (no monitor/keyboard)
- As a starting point for your own project using an access point and/or captive portal
- As a resource to get inspired by and to consult if you are stuck. The code contains links to other useful resources like package documentations, stack overflow questions etc.

## Setup

> [!tip]
> Raspberry Pi OS Bookworm (12) comes with a new [Network Manager](https://www.raspberrypi.com/documentation/computers/configuration.html#configuring-networking). It might make the configuration easier instead of manually having to setup `dhcp`, `hostapd` etc. (the latter is what we do in this project, but automatically for you). Nevertheless, this project still works on Bookworm 😊

<details>
  <summary><strong>Installation</strong></summary>

  If you connect to the Raspberry Pi from remote, make sure to do so via Ethernet and NOT via WiFi as the setup script will create its own WiFi network and thus you won't be connected anymore (and maybe even lock yourself out of your Raspi). Python is installed by default on a Raspberry Pi, so clone this repository and execute the setup:

  <sub>Note that the script needs to run as sudo user. Make sure that you agree with the commands executed beforehand by looking into the `.sh` scripts in the folder `access-point/`.</sub>

  ```bash
  git clone https://github.com/Splines/raspi-captive-portal.git
  cd ./raspi-captive-portal/
  # Run the access point setup script
  sudo ./access-point/setup-access-point.sh
  # Copy and enable the Python server service
  sudo ./access-point/setup-server.sh
  ```

</details>

<details>
  <summary><strong>Connection</strong></summary>

  After the installation, you should be able to connect to the new WiFi network called `ByteNode - Pi` (no password required). You should be redirected to the WiFi configuration page. If you open a "normal" browser, type in any http URL (http**s** URLs are not working) and you should also get redirected to the configuration page. The URL is supposed to read `splines.portal` (but visiting any URL should redirect there).

  **Using the WiFi Configuration Interface:**
  1. Click "Scan for Networks" to see available WiFi networks
  2. Select the network you want to connect to
  3. Enter the password if the network is secured
  4. Click "Connect" to connect the Raspberry Pi to that network
  5. The access point will remain active after connection - you can disable it manually if needed

  From here on you can build your custom captive portal webpage by customizing the code in the `server/server.py` file and the `server/public/` folder of this project.

</details>


<details>
  <summary><strong>Customization</strong></summary>

  To customize the WiFi SSID, password and the like, simply change the respective key-value pairs in the config files inside the folder `access-point/`. Then run the setup scripts again to apply the changes:
  ```bash
  sudo ./access-point/setup-access-point.sh
  sudo ./access-point/setup-server.sh
  ```
  
  Furthermore, you can adjust server settings in the file `server/server.py`.

  Some default values:

  - static ip for the raspi: `192.168.4.1/24`
  - using `wlan0` as interface
  - WiFi: SSID: `ByteNode - Pi` (open network, no password),
    <br>country code: `DE` (change if you are not in Germany)
  - Server: port: `8090` (all requests on port 80 (http) get redirected to this port), host name: `splines.portal`
  - WiFi management: Uses `nmcli` (NetworkManager) for scanning and connecting

</details>


<details>
    <summary><strong>Troubleshooting</strong></summary>

If this first assistance does not help, feel free to open a new issue.

🎈 **I can't connect to the `ByteNode - Pi` WiFi or get thrown out**

The network is open (no password required). The Raspberry Pi won't provide Internet access to you, it will just serve the WiFi configuration page as captive portal. This is why you might get thrown out of the WiFi network. If this is the case, there is usually an option to "Use this network without Internet access" (or the like). It might also help to disable mobile data.

🎈 **How can I use a "normal" browser when I have to click "Cancel" in the captive portal?**

The Raspberry Pi serves as Access Point and does not provide Internet access to you. Therefore on the captive portal you might have to click "cancel" (e.g. on iOS) and then "Use this network without Internet access" (or the like). After that, you can open any "real" browser on your phone, e.g. Chrome, Firefox, Safari (and so forth), and go to the website `splines.portal` (any other website should redirect you to this page).

🎈 **I don't see the `ByteNode - Pi` WiFi network**

Make sure that everything worked fine in the installation script. Check the output of hostapd (host access point daemon); has it started correctly?

```bash
sudo systemctl status hostapd
```

If it failed try to restart it:

```bash
sudo systemctl restart hostapd
```

If this fails, make sure that [`./access-point/hostapd.conf`](./access-point/hostapd.conf) has the correct country code set for the country you are located in. If you modify this, you have to run the setup script again afterwards (`sudo python setup.py`) (like for any modification of the config files of this project). If this does not help, you might have to set the country code manually by means of `sudo raspi-config`, see [issue #12](https://github.com/Splines/raspi-captive-portal/issues/12).

And last but not least, sometimes reboots work wonders:

```bash
sudo restart
```

🎈 **I see the `Splines Raspi AP` WiFi network, but the web page doesn't show up**

Access the URL `splines.portal` in your browser. Also make sure that the server serving the HTML pages is up and running:

```bash
sudo systemctl status access-point-server
```

The output should contain: "Captive Portal Server running on port 8090". Any error here? Try to restart the service:

```bash
sudo systemctl restart access-point-server
```

You can also run the server manually for debugging:

```bash
cd server
python3 server.py
```


</details>


## Other

<details>
  <summary><strong>Dependencies</strong></summary>
  This project was developed and tested on the Raspberry Pi 4, Raspberry Pi OS: Bullseye (11) & Bookworm (12) (64-bit).

  These are the principal dependencies used in this project:

  *Captive Portal & Access Point*
  - `dhcpcd`:  DHCP server (automatically assign IP addresses to clients)
  - `hostapd`: Access Point (AP)
  - `dnsmasq`: DNS server (name resolution)
  - `netfilter-persistent` & `iptables-persistent`: Save firewall rules and restore them when the Raspberry Pi boots

  *Python Web Server*
  - Python 3 (standard library only - no external packages required)
  - `nmcli` (NetworkManager CLI) for WiFi scanning and connection management 

</details>

<details>
    <summary><strong>License</strong></summary>

This program is licensed with the very permissive MIT license, see the [LICENSE file](https://github.com/Splines/raspi-captive-portal/blob/main/LICENSE) for details. As this is only a small project, I don't require you to include the license header in every source file. However, you must include a copyright notice in your project, that is, link back to this project, e.g. in this way:

> [Captive Portal & Access Point setup](https://github.com/Splines/raspi-captive-portal) - Copyright (c) Splines

Any questions regarding the license? [This FAQ](https://www.tawesoft.co.uk/kb/article/mit-license-faq) might help.

The logo of this project is exempt from the MIT license and you must *not* use it in any of your work. Icons used in the logo are bought from thenounproject.com ([1](https://thenounproject.com/icon/raspberry-pi-1109535/) and [2](https://thenounproject.com/icon/wifi-170991/)).

</details>
