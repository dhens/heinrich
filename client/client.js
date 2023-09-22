const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const userList = document.getElementById('userList');
const myIdDisplay = document.getElementById('myId');

const socket = new WebSocket('ws://localhost:8080');

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = localStream;
});

socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
        case 'your-id':
            myIdDisplay.textContent = msg.id;
            break;

        case 'online-users':
            updateUserList(msg.users);
            break;

        case 'offer':
            handleOffer(msg);
            break;

        case 'answer':
            handleAnswer(msg);
            break;

        case 'candidate':
            handleIceCandidate(msg);
            break;
    }
});

function updateUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        li.addEventListener('click', () => initiateCall(user));
        userList.appendChild(li);
    });
}

function initiateCall(otherId) {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', target: otherId, candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.createOffer().then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.send(JSON.stringify({ type: 'offer', target: otherId, offer: peerConnection.localDescription }));
        });
}

function handleOffer(msg) {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', target: msg.source, candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.setRemoteDescription(msg.offer).then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.send(JSON.stringify({ type: 'answer', target: msg.source, answer: peerConnection.localDescription }));
        });
}

function handleAnswer(msg) {
    peerConnection.setRemoteDescription(msg.answer);
}

function handleIceCandidate(msg) {
    peerConnection.addIceCandidate(msg.candidate);
}
