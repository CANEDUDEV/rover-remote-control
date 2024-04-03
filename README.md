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

You need a HTTPS connection for the gamepad to work when using Firefox. Run
`tailscale cert` to generate a certificate. See this link for prerequisites:
https://tailscale.com/kb/1153/enabling-https

1. Set the rpi's hostname to `rover`. Register it in tailscale so it is
   accessible using `ping rover`.
2. Run `docker compose up -d` on the rpi
3. Access the rover's hostname at port 8080 in the browser.
