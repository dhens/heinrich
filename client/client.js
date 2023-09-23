const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const userList = document.getElementById('userList');
const myIdDisplay = document.getElementById('myId');
const audioSelect = document.querySelector('#audioSource');
const videoSelect = document.querySelector('#videoSource');

const socket = new WebSocket('wss://talk.widesword.net');
let localStream;
let peerConnection;

const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
};  

navigator.mediaDevices.enumerateDevices().then(getDevices).catch(handleError);

function getDevices(deviceInfos) {
    const audioSelect = document.getElementById('audioSource');
    const videoSelect = document.getElementById('videoSource');
    
    let audioCount = 0;
    let videoCount = 0;

    for (let i = 0; i !== deviceInfos.length; ++i) {
        let deviceInfo = deviceInfos[i];
        let option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            audioCount++;
            option.text = deviceInfo.label || 'Microphone ' + audioCount;
            audioSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            videoCount++;
            option.text = deviceInfo.label || 'Camera ' + videoCount;
            videoSelect.appendChild(option);
        }
    }
}

audioSelect.addEventListener('change', switchDevice);
videoSelect.addEventListener('change', switchDevice);

async function switchDevice() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    const selectedAudioSource = audioSelect.value;
    const selectedVideoSource = videoSelect.value;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: selectedVideoSource ? { exact: selectedVideoSource } : undefined },
            audio: { deviceId: selectedAudioSource ? { exact: selectedAudioSource } : undefined }
        });
        localVideo.srcObject = localStream;

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
    } catch (error) {
        handleError(error);
    }
}

switchDevice();

function handleError(error) {
    console.log("Error:", error);
}

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
    const pc = setupPeerConnection(true, otherId);
    pc.createOffer().then(offer => pc.setLocalDescription(offer))
        .then(() => {
            socket.send(JSON.stringify({ type: 'offer', target: otherId, offer: pc.localDescription }));
        });
}

function handleOffer(msg) {
    const pc = setupPeerConnection(false, msg.source);
    pc.setRemoteDescription(msg.offer).then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            socket.send(JSON.stringify({ type: 'answer', target: msg.source, answer: pc.localDescription }));
        });
}

function handleAnswer(msg) {
    peerConnection.setRemoteDescription(msg.answer);
}

function handleIceCandidate(msg) {
    peerConnection.addIceCandidate(msg.candidate);
}
