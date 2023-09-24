const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const userList = document.getElementById('userList');
const myIdDisplay = document.getElementById('myId');

const chatHistory = document.getElementById("chat-history");
const messagePad = document.getElementById("messagePad");
const audioSelect = document.getElementById('audioSource');
const videoSelect = document.getElementById('videoSource');

audioSelect.addEventListener('change', switchDevice);
videoSelect.addEventListener('change', switchDevice);
navigator.mediaDevices.enumerateDevices().then(getDevices);
// Required to kickoff device selection for mic//video input. 
// Otherwise, you have to change the inputs to get audio/video out.
navigator.mediaDevices.enumerateDevices().then(switchDevice);

let currentAudioVideoDevices;

let user = {
    id: ""
}

// Send new message to server if Enter key is pressed while in focus of message input element.
messagePad.addEventListener("keypress", event => {
    if (event.key === "Enter") {
        sendNewChat()
    }
});


async function switchDevice() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    localStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: videoSelect.value ? { exact: videoSelect.value } : undefined },
        audio: { deviceId: audioSelect.value ? { exact: audioSelect.value } : undefined }
    });
    localVideo.srcObject = localStream;
    // Set global audio / video settings.
    currentAudioVideoDevices = localStream;

    if (peerConnection) {
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
            if (sender.track.kind === 'audio' && localStream.getAudioTracks().length > 0) {
                sender.replaceTrack(localStream.getAudioTracks()[0]);
            } else if (sender.track.kind === 'video' && localStream.getVideoTracks().length > 0) {
                sender.replaceTrack(localStream.getVideoTracks()[0]);
            }
        });
    }
}

async function getMedia() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(async (stream) => {
        let selectedAudioSource = audioSelect.value;
        let selectedVideoSource = videoSelect.value;

        localStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: selectedVideoSource ? { exact: selectedVideoSource } : undefined },
            audio: { deviceId: selectedAudioSource ? { exact: selectedAudioSource } : undefined }
        });
        localVideo.srcObject = localStream;
    });
}

function getDevices(deviceInfos) {
    for (let i = 0; i !== deviceInfos.length; ++i) {
        let deviceInfo = deviceInfos[i];
        let option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label || 'Microphone ' + (audioSelect.length + 1);
            audioSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || 'Camera ' + (videoSelect.length + 1);
            videoSelect.appendChild(option);
        }
    }
}

const socket = new WebSocket('wss://talk.widesword.net');
let localStream;
let peerConnection;
let connectedPeers = {};

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ]
};

socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
        case 'your-id':
            myIdDisplay.textContent = msg.id;
            // Set username
            user.id = msg.id;
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
        case 'new-chat':
            renderNewChat(msg)
            break;

    }
});

var un_mute = document.getElementById('un-mute');

un_mute.onclick = function() {
    const currentAudioTrackEnabled = currentAudioVideoDevices.getAudioTracks()[0].enabled;
    if (currentAudioTrackEnabled) {
        currentAudioVideoDevices.getAudioTracks()[0].enabled = false;
    } else {
        currentAudioVideoDevices.getAudioTracks()[0].enabled = true;
    }
};


function addPeer(peerID) {
    connectedPeers[peerID] = 1;
}

function renderNewChat(msg) {
    const newMessageListItem = document.createElement("li")
    newMessageListItem.textContent = `${msg.author}: ${msg.content}`;
    chatHistory.appendChild(newMessageListItem)
}

function sendNewChat() {
    if (messagePad.value.length > 2048) {
        alert("Maximum character limit of 2048 characters. Please shorten your message and try again.")
        return;
    }
    // Send the message to every peer you're connected to.
    const chatRecipients = Object.keys(connectedPeers)
    const body = {type: "new-chat", content: messagePad.value, author: user.id, timestamp: Date.now()};
    for (let i = 0; i < chatRecipients.length; i++) {
        const peer = chatRecipients[i]
        body.target = peer;
        socket.send(JSON.stringify(body));    
    }
    renderNewChat(body)
    clearChatInputElement();
}

function clearChatInputElement() {
    messagePad.value = "";
}

function updateUserList(users) {
    userList.innerHTML = '';
    if (users.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No one is here yet. Maybe invite someone?";
        userList.appendChild(li);
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        li.addEventListener('click', () => initiateCall(user));
        userList.appendChild(li);
    });
}

function setupPeerConnection(isCaller, otherId) {
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
    return peerConnection;
}

function initiateCall(otherId) {
    // Reset peers so we don't send messages to stale peers
    connectedPeers = {};
    const pc = setupPeerConnection(true, otherId);
    pc.createOffer().then(offer => pc.setLocalDescription(offer))
        .then(() => {
            socket.send(JSON.stringify({ type: 'offer', target: otherId, offer: pc.localDescription }));
        });
    // Add other user to list of peers.
    // msg.source is the id of the "source" on the other end of the call.
    connectedPeers[otherId] = 1;

}

function handleOffer(msg) {
    const pc = setupPeerConnection(false, msg.source);
    pc.setRemoteDescription(msg.offer).then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            socket.send(JSON.stringify({ type: 'answer', target: msg.source, answer: pc.localDescription }));
    });
    // Add other user to list of peers.
    // msg.source is the id of the "source" on the other end of the call.
    connectedPeers[msg.source] = 1;
}

function handleAnswer(msg) {
    peerConnection.setRemoteDescription(msg.answer);
    // Add other user to list of peers.
    // msg.source is the id of the "source" on the other end of the call.
    connectedPeers[msg.source] = 1;
}

function handleIceCandidate(msg) {
    peerConnection.addIceCandidate(msg.candidate);
}
