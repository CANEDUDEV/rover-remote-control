// get DOM elements
var dataChannelLog = document.getElementById('data-channel'),
  iceConnectionLog = document.getElementById('ice-connection-state'),
  iceGatheringLog = document.getElementById('ice-gathering-state'),
  signalingLog = document.getElementById('signaling-state');


// peer connection
var pc = null;

// data channel
var dc = null, dcInterval = null;

function createPeerConnection() {
  var config = {
    sdpSemantics: 'unified-plan'
  };

  //if (document.getElementById('use-stun').checked) {
  config.iceServers = [{ urls: ['stun:rover:3478'] }];
  //}

  pc = new RTCPeerConnection(config);

  // register some listeners to help debugging
  pc.addEventListener('icegatheringstatechange', () => {
    iceGatheringLog.textContent += ' -> ' + pc.iceGatheringState;
  }, false);
  iceGatheringLog.textContent = pc.iceGatheringState;

  pc.addEventListener('iceconnectionstatechange', () => {
    iceConnectionLog.textContent += ' -> ' + pc.iceConnectionState;
  }, false);
  iceConnectionLog.textContent = pc.iceConnectionState;

  pc.addEventListener('signalingstatechange', () => {
    signalingLog.textContent += ' -> ' + pc.signalingState;
  }, false);
  signalingLog.textContent = pc.signalingState;

  // connect audio / video
  //pc.addEventListener('track', (evt) => {
  //    if (evt.track.kind == 'video')
  //        document.getElementById('video').srcObject = evt.streams[0];
  //    else
  //        document.getElementById('audio').srcObject = evt.streams[0];
  //});

  return pc;
}

function negotiate() {
  return pc.createOffer().then((offer) => {
    return pc.setLocalDescription(offer);
  }).then(() => {
    // wait for ICE gathering to complete
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        function checkState() {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        }
        pc.addEventListener('icegatheringstatechange', checkState);
      }
    });
  }).then(() => {
    var offer = pc.localDescription;
    //var codec;

    //codec = document.getElementById('audio-codec').value;
    //if (codec !== 'default') {
    //    offer.sdp = sdpFilterCodec('audio', codec, offer.sdp);
    //}

    //codec = document.getElementById('video-codec').value;
    //if (codec !== 'default') {
    //    offer.sdp = sdpFilterCodec('video', codec, offer.sdp);
    //}

    document.getElementById('offer-sdp').textContent = offer.sdp;
    return fetch('/offer', {
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type
        //video_transform: document.getElementById('video-transform').value
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });
  }).then((response) => {
    return response.json();
  }).then((answer) => {
    document.getElementById('answer-sdp').textContent = answer.sdp;
    return pc.setRemoteDescription(answer);
  }).catch((e) => {
    alert(e);
  });
}

function start() {
  document.getElementById('start').style.display = 'none';

  pc = createPeerConnection();

  var time_start = null;

  const current_stamp = () => {
    if (time_start === null) {
      time_start = new Date().getTime();
      return 0;
    } else {
      return new Date().getTime() - time_start;
    }
  };

  //if (document.getElementById('use-datachannel').checked) {
  //var parameters = JSON.parse(document.getElementById('datachannel-parameters').value);

  dc = pc.createDataChannel('chat');
  dc.addEventListener('close', () => {
    clearInterval(dcInterval);
    dataChannelLog.textContent += '- close\n';
  });
  dc.addEventListener('open', () => {
    dataChannelLog.textContent += '- open\n';
    dcInterval = setInterval(() => {
      var message = 'ping ' + current_stamp();
      dataChannelLog.textContent += '> ' + message + '\n';
      dc.send(message);
    }, 1000);
  });
  dc.addEventListener('message', (evt) => {
    dataChannelLog.textContent += '< ' + evt.data + '\n';

    if (evt.data.substring(0, 4) === 'pong') {
      var elapsed_ms = current_stamp() - parseInt(evt.data.substring(5), 10);
      dataChannelLog.textContent += ' RTT ' + elapsed_ms + ' ms\n';
    }
  });
  //}

  // Build media constraints.

  //const constraints = {
  //    audio: false,
  //    video: false
  //};

  //if (document.getElementById('use-audio').checked) {
  //    const audioConstraints = {};

  //    const device = document.getElementById('audio-input').value;
  //    if (device) {
  //        audioConstraints.deviceId = { exact: device };
  //    }

  //    constraints.audio = Object.keys(audioConstraints).length ? audioConstraints : true;
  //}

  //if (document.getElementById('use-video').checked) {
  //    const videoConstraints = {};

  //    const device = document.getElementById('video-input').value;
  //    if (device) {
  //        videoConstraints.deviceId = { exact: device };
  //    }

  //    const resolution = document.getElementById('video-resolution').value;
  //    if (resolution) {
  //        const dimensions = resolution.split('x');
  //        videoConstraints.width = parseInt(dimensions[0], 0);
  //        videoConstraints.height = parseInt(dimensions[1], 0);
  //    }

  //    constraints.video = Object.keys(videoConstraints).length ? videoConstraints : true;
  //}

  //// Acquire media and start negociation.

  //if (constraints.audio || constraints.video) {
  //    if (constraints.video) {
  //        document.getElementById('media').style.display = 'block';
  //    }
  //    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
  //        stream.getTracks().forEach((track) => {
  //            pc.addTrack(track, stream);
  //        });
  //        return negotiate();
  //    }, (err) => {
  //        alert('Could not acquire media: ' + err);
  //    });
  //} else {
  negotiate();
  //}

  document.getElementById('stop').style.display = 'inline-block';
}

function stop() {
  document.getElementById('start').style.display = 'inline-block';
  document.getElementById('stop').style.display = 'none';

  // close data channel
  if (dc) {
    dc.close();
  }

  // close transceivers
  if (pc.getTransceivers) {
    pc.getTransceivers().forEach((transceiver) => {
      if (transceiver.stop) {
        transceiver.stop();
      }
    });
  }

  // close local audio / video
  //pc.getSenders().forEach((sender) => {
  //    sender.track.stop();
  //});

  // close peer connection
  setTimeout(() => {
    pc.close();
  }, 500);
}

let gamepadInfo = document.getElementById("gamepad-info");

// Check if Gamepad API is supported
if ("getGamepads" in navigator) {
  // Initialize gamepad state
  let gamepad;

  // Function to update gamepad state
  function updateGamepadState() {
    // Get gamepads
    let detectedGamepads = navigator.getGamepads();
    if (detectedGamepads.length < 1) {
      gamepadInfo.innerHTML = "No gamepad detected.";
      gamepad = null;
      return;
    }

    // Assume only one gamepad
    gamepad = detectedGamepads[0];
  }

  // Function to handle gamepad input
  function handleGamepadInput() {
    // Update gamepad state
    updateGamepadState();

    if (gamepad) {
      // Clear previous gamepad info
      gamepadInfo.innerHTML = "";

      // Need to map 3 axes, 1 for the wheel and 1 for each pedal
      if (gamepad.axes.length < 3) {
        gamepadInfo.innerHTML = "Gamepad " + gamepad.id + " is not supported.";
      }

      // Display gamepad info
      gamepadInfo.innerHTML += "<div>Gamepad " + gamepad.index + ": " + gamepad.id + "</div>";

      let wheel = gamepad.axes[0]; // From -1 to 1, 0 is neutral
      let right_pedal = gamepad.axes[1]; // From -1 to 1, -1 is neutral
      let left_pedal = gamepad.axes[2]; // From -1 to 1, -1 is neutral

      gamepadInfo.innerHTML += "<div>Wheel: " + wheel.toFixed(2) + "</div>";
      gamepadInfo.innerHTML += "<div>Right pedal: " + right_pedal.toFixed(2) + "</div>";
      gamepadInfo.innerHTML += "<div>Left pedal: " + left_pedal.toFixed(2) + "</div>";
    }
  }

  // Set up gamepad input polling
  setInterval(handleGamepadInput, 20); // Poll every 20ms

} else {
  // Gamepad API not supported
  gamepadInfo.innerHTML = "Gamepad API not supported in this browser";
}
