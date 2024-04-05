import logging
import subprocess
import struct
import ssl
import uuid
import json
import platform
import asyncio
import argparse

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcrtpsender import RTCRtpSender
from aiohttp import web

import can

logger = logging.getLogger("pc")
logging.basicConfig(level=logging.INFO)

pcs = set()

relay = None
webcam = None

def create_local_track():
    global relay, webcam

    options = {"framerate": "30", "video_size": "640x480"}
    if relay is None:
        if platform.system() == "Darwin":
            webcam = MediaPlayer(
                "default:none", format="avfoundation", options=options
            )
        elif platform.system() == "Windows":
            webcam = MediaPlayer(
                "video=Integrated Camera", format="dshow", options=options
            )
        else:
            webcam = MediaPlayer("/dev/video0", format="v4l2", options=options)
        relay = MediaRelay()
    return relay.subscribe(webcam.video)


def force_codec(pc, sender, forced_codec):
    kind = forced_codec.split("/")[0]
    codecs = RTCRtpSender.getCapabilities(kind).codecs
    transceiver = next(t for t in pc.getTransceivers() if t.sender == sender)
    transceiver.setCodecPreferences(
        [codec for codec in codecs if codec.mimeType == forced_codec]
    )

async def index(_):
    return web.FileResponse('static/index.html')


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    pc_id = "PeerConnection(%s)" % uuid.uuid4()

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    subprocess.run(["ip", "link", "set", "can0", "up", "type", "can", "bitrate", "125000"])

    ch = can.Bus(interface="socketcan", channel="can0", bitrate=125000)

    # Set SBUS receiver to silent mode
    ch.send(can.Message(
        arbitration_id=0,
        dlc=8,
        data=[4, 0, 0, 0x1, 0, 0, 0, 0],
        is_extended_id=False,
    ))

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if message and isinstance(message, str):
                frames = can_frames_from_message(message)
                for frame in frames:
                    try:
                        ch.send(frame)
                    except can.CanError:
                        logger.error("Couldn't send CAN message %s", frame)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed" or pc.connectionState == "closed":
            # Set SBUS receiver to comm mode
            ch.send(can.Message(
                arbitration_id=0,
                dlc=8,
                data=[4, 0, 0, 0x3, 0, 0, 0, 0],
                is_extended_id=False,
            ))
            ch.shutdown()

            subprocess.run(["ip", "link", "set", "can0", "down"])

            await pc.close()
            pcs.discard(pc)

    video = create_local_track()

    if video:
        video_sender = pc.addTrack(video)
        force_codec(pc, video_sender, "video/h264")

    # handle offer
    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )

def can_frames_from_message(message):
    cmd = json.loads(message)
    if "wheel" not in cmd or "right_pedal" not in cmd or "left_pedal" not in cmd:
        return []

    wheel = cmd['wheel']
    right_pedal = cmd['right_pedal']
    left_pedal = cmd['left_pedal']

    return [
        create_steering_frame(wheel),
        create_throttle_frame(right_pedal, left_pedal),
    ]

def create_steering_frame(wheel):
    id = 0x100
    dlc = 5
    angle = float(wheel*45)
    data = [1] + list(struct.pack("f", angle))
    return can.Message(
        arbitration_id=id,
        data=data,
        dlc=dlc,
        is_extended_id=False,
    )

def create_throttle_frame(right_pedal, left_pedal):
    # Pedals come in at values between -1 and 1,
    # where -1 is fully depressed and 1 is fully pressed.
    # We need to convert the pedal state to PWM pulses.
    # Right pedal accelerates while left pedal brakes and reverses.
    if left_pedal > -1:
        # Brake pressed
        pulse = 1500 + 500 * (left_pedal + 1) / 2
    else:
        pulse = 1500 - 500 * (right_pedal + 1) / 2

    pulse = int(round(pulse))
    id = 0x101
    dlc = 5
    data = [0] + list(pulse.to_bytes(2, "little", signed=True)) + [0, 0]
    return can.Message(
        arbitration_id=id,
        data=data,
        dlc=dlc,
        is_extended_id=False,
    )

async def on_shutdown(_):
    # close peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Rover remote control demo")

    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")

    args = parser.parse_args()

    if args.cert_file:
        ssl_context = ssl.SSLContext(protocol=ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
        port = 443
    else:
        ssl_context = None
        port = 80

    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_static('/static/', path='static', name='static')
    app.router.add_get('/', index)
    app.router.add_post('/offer', offer)
    web.run_app(app, port=port, ssl_context=ssl_context)
