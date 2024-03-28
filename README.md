# rover-remote-control

Requirements for this project:
 - Raspberry pi 4 4gb with docker installed
 - Windows PC with steering wheel
 - Tailscale on PC and rpi
 - Universal Control Remapper (UCR) and vJoy for Windows

Currently only the SuperDrive SV450 steering wheel is supported. To add support
for other wheels, you need to create UCR profiles for them. The UCR profile
configuration is the file `ucr/context.xml` and needs to be copied to the same
folder as the UCR executable.

1. Run `tailscale ip` on rpi, copy IPv4
2. Run `docker compose up -d` on the rpi
3. Paste the IP from step 1 into a web browser.
