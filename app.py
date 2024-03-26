import logging

from aiortc import RTCPeerConnection, RTCSessionDescription
import uuid
from aiohttp import web
import json

logger = logging.getLogger("pc")
logging.basicConfig(level=logging.INFO)

pcs = set()

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

    # prepare local media
    #player = MediaPlayer(os.path.join(ROOT, "demo-instruct.wav"))
    #if args.record_to:
    #    recorder = MediaRecorder(args.record_to)
    #else:
    #    recorder = MediaBlackhole()

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                channel.send("pong" + message[4:])

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    #@pc.on("track")
    #def on_track(track):
    #    log_info("Track %s received", track.kind)

    #    if track.kind == "audio":
    #        pc.addTrack(player.audio)
    #        recorder.addTrack(track)
    #    elif track.kind == "video":
    #        pc.addTrack(
    #            VideoTransformTrack(
    #                relay.subscribe(track), transform=params["video_transform"]
    #            )
    #        )
    #        if args.record_to:
    #            recorder.addTrack(relay.subscribe(track))

    #    @track.on("ended")
    #    async def on_ended():
    #        log_info("Track %s ended", track.kind)
    #        await recorder.stop()

    # handle offer
    await pc.setRemoteDescription(offer)
    #await recorder.start()

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )

if __name__ == '__main__':
    app = web.Application()
    app.router.add_static('/static/', path='static', name='static')
    app.router.add_get('/', index)
    app.router.add_post('/offer', offer)
    web.run_app(app)
