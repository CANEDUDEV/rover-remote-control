// get DOM elements
var dataChannelLog = document.getElementById('data-channel'),
  iceConnectionLog = document.getElementById('ice-connection-state'),
  iceGatheringLog = document.getElementById('ice-gathering-state'),
  signalingLog = document.getElementById('signaling-state');

let gamepadInfo = document.getElementById("gamepad-info");
let wheel, right_pedal, left_pedal;

// peer connection
var pc = null;

// data channel
var dc = null, dcInterval = null;

function createPeerConnection() {
  var config = {
    sdpSemantics: 'unified-plan'
  };

  // Use this for local testing
  //config.iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];

  config.iceServers = [{ urls: ['stun:rover:3478'] }];

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

  // connect video
  pc.addEventListener('track', (evt) => {
    if (evt.track.kind == 'video') {
      document.getElementById('video').srcObject = evt.streams[0];
    }
  });

  return pc;
}

function negotiate() {
  pc.addTransceiver('video', { direction: 'recvonly' });
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

  dc = pc.createDataChannel('chat');
  dc.addEventListener('close', () => {
    clearInterval(dcInterval);
    dataChannelLog.textContent += '- close\n';
  });
  dc.addEventListener('open', () => {
    dataChannelLog.textContent += '- open\n';
    dcInterval = setInterval(() => {
      var message = JSON.stringify({ "wheel": wheel, "left_pedal": left_pedal, "right_pedal": right_pedal });
      dc.send(message);
    }, 20);
  });

  negotiate();

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

  // close peer connection
  setTimeout(() => {
    pc.close();
  }, 500);
}

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

      wheel = gamepad.axes[0]; // From -1 to 1, 0 is neutral
      right_pedal = gamepad.axes[1]; // From -1 to 1, -1 is neutral
      left_pedal = gamepad.axes[2]; // From -1 to 1, -1 is neutral

      gamepadInfo.innerHTML += "<div>Wheel: " + wheel.toFixed(2) + "</div>";
      gamepadInfo.innerHTML += "<div>Right pedal: " + right_pedal.toFixed(2) + "</div>";
      gamepadInfo.innerHTML += "<div>Left pedal: " + left_pedal.toFixed(2) + "</div>";
    }
  }

  // Set up gamepad input polling every 20 ms
  setInterval(handleGamepadInput, 20);

} else {
  // Gamepad API not supported
  gamepadInfo.innerHTML = "Gamepad API not supported in this browser";
}
