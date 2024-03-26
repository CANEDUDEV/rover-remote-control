# rover-remote-control

Requirements for this project:
 - Raspberry pi 4 4gb
 - Tailscale on PC and rpi

1. Run `tailscale ip` on rpi, copy IPv4
2. Run `python app.y` on the rpi
3. Connect to the copied IP on port 8080 using a web browser. Don't use the
   tailscale hostname as this will not work.
