import os
import re
import subprocess
import sys

from setup.cli import query_yes_no
from setup.colorConsole import ColorPrint, cyan, magenta


def print_header():
    header = """
    ###################################################
    #########       Raspi Captive Portal      #########
    #########   A Raspberry Pi Access Point   #########
    #########  & Captive Portal setup script  #########
    ###################################################
    """
    ColorPrint.print(cyan, header)


def check_super_user():
    print()
    ColorPrint.print(cyan, "▶ Check sudo")

    # Is root?
    if os.geteuid() != 0:
        print("You need root privileges to run this script.")
        print('Please try again using "sudo"')
        sys.exit(1)
    else:
        print("Running as root user, continue.")


def setup_access_point():
    print()
    ColorPrint.print(cyan, "▶ Setup Access Point (WiFi)")

    print("We will now set up the Raspi as Access Point to connect to via WiFi.")
    print("The following commands will execute as sudo user.")
    print('Please make sure you look through the file "./access-point/setup-access-point.sh"')
    print("first before approving.")
    answer = query_yes_no("Continue?", default="yes")

    if not answer:
        return sys.exit(0)

    subprocess.run("sudo chmod a+x ./access-point/setup-access-point.sh", shell=True, check=True)
    subprocess.run("./access-point/setup-access-point.sh", shell=True, check=True)


def setup_server_service():
    print()
    ColorPrint.print(cyan, "▶ Configure Python server to start at boot")

    # Replace path in file
    server_path = os.path.join(os.getcwd(), "server")
    server_config_path = "./access-point/access-point-server.service"
    with open(server_config_path, "r", encoding="utf-8") as f:
        filedata = f.read()
    filedata = re.sub(r"WorkingDirectory=.*", f"WorkingDirectory={server_path}", filedata)
    with open(server_config_path, "w", encoding="utf-8") as f:
        f.write(filedata)

    print("We will now register the Python server as a Linux service and configure")
    print("it to start at boot time.")
    print("The following commands will execute as sudo user.")
    print('Please make sure you look through the file "./access-point/setup-server.sh"')
    print("first before approving.")
    answer = query_yes_no("Continue?", default="yes")

    if not answer:
        return sys.exit(0)

    subprocess.run("sudo chmod a+x ./setup-server.sh", shell=True, cwd="./access-point", check=True)
    subprocess.run("./setup-server.sh", shell=True, cwd="./access-point", check=True)


def setup_wifi_fallback():
    print()
    ColorPrint.print(cyan, "▶ Setup WiFi Fallback Service")

    print("This will set up automatic WiFi fallback on boot:")
    print("  - After WiFi connection, captive portal auto-disables")
    print("  - On boot, if WiFi fails, captive portal auto-starts")
    print("  - Ensures normal network access to AdGuard and other services")
    print()
    print("The following commands will execute as sudo user.")
    print('Please make sure you look through the file "./access-point/setup-wifi-fallback.sh"')
    print("first before approving.")
    answer = query_yes_no("Continue?", default="yes")

    if not answer:
        print("Skipping WiFi fallback setup. You can run it manually later with:")
        print("  cd ~/raspi-captive-portal/access-point && sudo ./setup-wifi-fallback.sh")
        return

    # Make all scripts in access-point directory executable
    print("Making scripts executable...")
    subprocess.run("sudo chmod a+x ./access-point/*.sh", shell=True, check=True)

    # Run the WiFi fallback setup script
    print("Running WiFi fallback setup...")
    subprocess.run("./setup-wifi-fallback.sh", shell=True, cwd="./access-point", check=True)

    print("WiFi fallback service installed successfully!")


def done():
    print()
    ColorPrint.print(cyan, "▶ Done")

    final_msg = (
        "Awesome, we are done here. Grab your phone and look for the\n"
        '"ByteNode - Pi" WiFi (no password required).'
        "\n"
        "When you connect to WiFi through the captive portal, it will\n"
        "automatically disable itself and restore normal network access.\n"
        "\n"
        "When you reboot the Raspi, wait 2 minutes, then:\n"
        "  - If WiFi works: Portal stays disabled, normal operation\n"
        "  - If WiFi fails: Portal auto-starts for reconfiguration\n"
        "\n"
        "If you like this project, consider giving a GitHub star ⭐\n"
        "If there are any problems, checkout the troubleshooting section here:\n"
        "https://github.com/Splines/raspi-captive-portal or open a new issue\n"
        "on GitHub."
    )
    ColorPrint.print(magenta, final_msg)


def execute_all():
    print_header()
    check_super_user()

    setup_access_point()
    setup_server_service()
    setup_wifi_fallback()

    done()


if __name__ == "__main__":
    execute_all()
