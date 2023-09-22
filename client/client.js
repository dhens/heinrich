const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const usernameInput = document.getElementById('usernameInput');
const peerInput = document.getElementById('peerInput');

let localStream;
let remoteStream;
let peerConnection;
let username;

let ws;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function login() {
  username = usernameInput.value;

  ws = new WebSocket('wss://worker-floral-voice-f21f.justaplayground.workers.dev/');
  ws.addEventListener('message', onMessage);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'login', name: username }));
  });
}

async function startCall() {
  const peerName = peerInput.value;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  // Mute local audio input so we don't hear ourselves.
  localVideo.muted = true;

  peerConnection = new RTCPeerConnection(configuration);
  peerConnection.onicecandidate = ({ candidate }) => send({ type: 'candidate', candidate });
  peerConnection.ontrack = ({ streams: [stream] }) => remoteVideo.srcObject = stream;
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  send({ type: 'offer', offer, name: peerName });
}

async function answerCall(offer) {
  const peerName = peerInput.value;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(configuration);
  peerConnection.onicecandidate = ({ candidate }) => send({ type: 'candidate', candidate });
  peerConnection.ontrack = ({ streams: [stream] }) => remoteVideo.srcObject = stream;
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  send({ type: 'answer', answer, name: peerName });
}

function onMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'offer':
      answerCall(data.offer);
      break;
    case 'answer':
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      break;
    case 'candidate':
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
    default:
      break;
  }
}

function send(data) {
  ws.send(JSON.stringify({ ...data, name: username }));
}
