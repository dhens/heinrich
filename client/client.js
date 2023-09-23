const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const userList = document.getElementById('userList');
const myIdDisplay = document.getElementById('myId');

const audioSelect = document.getElementById('audioSource');
const videoSelect = document.getElementById('videoSource');

let localStream;
let remoteStream;
let peerConnection;
let username;
let pendingCandidates = []; // Queue to store ICE candidates before setting remote description

async function switchDevice() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    localStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: videoSelect.value ? { exact: videoSelect.value } : undefined },
        audio: { deviceId: audioSelect.value ? { exact: audioSelect.value } : undefined }
    });
    localVideo.srcObject = localStream;

async function login() {
    username = usernameInput.value;

    ws = new WebSocket('wss://talk.widesword.net/');
    ws.addEventListener('message', onMessage);
    ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'login', target: username }));
    });
}

async function startCall() {
    const peerName = peerInput.value;

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localVideo.muted = true;

    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            send({ type: 'candidate', candidate, target: peerName });
        }
    };
    peerConnection.ontrack = ({ streams: [stream] }) => remoteVideo.srcObject = stream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    send({ type: 'offer', offer: peerConnection.localDescription, target: peerName });
}

async function answerCall(offer) {
    if (!peerConnection) {
        await setupPeerConnection();
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    send({ type: 'answer', answer: peerConnection.localDescription, target: peerInput.value });
}

async function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            send({ type: 'candidate', candidate, target: peerInput.value });
        }
    };
    
    peerConnection.ontrack = ({ streams: [stream] }) => remoteVideo.srcObject = stream;

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    } else {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

function onMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
      case 'offer':
          answerCall(data.offer);
          break;
      case 'answer':
          if (!peerConnection) {
              console.error('PeerConnection is not initialized.');
              return;
          }
          // Check if the current signaling state is expecting an answer
          if (peerConnection.signalingState !== "have-local-offer") {
              console.error(`Unexpected signaling state for answer: ${peerConnection.signalingState}`);
              return;
          }
          peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
              .then(() => {
                  // Process the queued candidates after setting the remote description
                  while (pendingCandidates.length) {
                      const candidate = pendingCandidates.shift();
                      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                  }
              });
          break;
      case 'candidate':
          if (!peerConnection) {
              console.error('PeerConnection is not initialized.');
              return;
          }
          if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
              peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
              pendingCandidates.push(data.candidate);
          }
          break;
      default:
          break;
  }
}

function send(data) {
    ws.send(JSON.stringify({...data, target: username }));
}
