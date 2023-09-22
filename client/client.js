let websocket = new WebSocket('wss://worker-floral-voice-f21f.justaplayground.workers.dev/');
let peerConnection;
const config = {
    iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
    }]
};

document.addEventListener("DOMContentLoaded", function() {
    let yourVideo = document.getElementById("yourVideo");
    let remoteVideo = document.getElementById("remoteVideo");

    navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(stream => {
        yourVideo.srcObject = stream;
    });

    websocket.onopen = function() {
        websocket.send(JSON.stringify({ register: true }));
    };

    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data['offer']) {
            const remoteOffer = new RTCSessionDescription(data['offer']);
            answerCall(remoteOffer);
        } else if (data['answer']) {
            const remoteAnswer = new RTCSessionDescription(data['answer']);
            peerConnection.setRemoteDescription(remoteAnswer);
        } else if (data['ice-candidate']) {
            const iceCandidate = new RTCIceCandidate(data['ice-candidate']);
            peerConnection.addIceCandidate(iceCandidate);
        } else if (data.id) {
            document.getElementById('yourIdDisplay').textContent = data.id;
        } else if (data.onlineUsers) {
            updateOnlineUsers(data.onlineUsers);
        }
    };

    function createPeerConnection() {
        peerConnection = new RTCPeerConnection(config);
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                websocket.send(JSON.stringify({ 'ice-candidate': event.candidate }));
            }
        };
        peerConnection.ontrack = event => {
            remoteVideo.srcObject = event.streams[0];
        };
        const stream = yourVideo.srcObject;
        for (const track of stream.getTracks()) {
            peerConnection.addTrack(track, stream);
        }
    }

    function startCall() {
        createPeerConnection();
        const offerOptions = {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        };
        peerConnection.createOffer(offerOptions).then(offer => {
            return peerConnection.setLocalDescription(offer);
        }).then(() => {
            websocket.send(JSON.stringify({ 'offer': peerConnection.localDescription }));
        });
    }

    function answerCall() {
        createPeerConnection();
        peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer))
        .then(() => {
            return peerConnection.createAnswer();
        }).then(answer => {
            return peerConnection.setLocalDescription(answer);
        }).then(() => {
            websocket.send(JSON.stringify({ 'answer': peerConnection.localDescription }));
        });
    }

    function updateOnlineUsers(users) {
        const onlineUsersDiv = document.getElementById("onlineUsers");
        onlineUsersDiv.innerHTML = '';
        users.forEach(user => {
            let userDiv = document.createElement("div");
            userDiv.classList.add("user");
            userDiv.textContent = user;
            userDiv.onclick = () => startCall();
            onlineUsersDiv.appendChild(userDiv);
        });
    }
});
