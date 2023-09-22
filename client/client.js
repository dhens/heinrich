let localStream;
let remoteStream = new MediaStream();
const yourVideo = document.getElementById("yourVideo");
const remoteVideo = document.getElementById("remoteVideo");
remoteVideo.srcObject = remoteStream;
const onlineUsersDiv = document.getElementById("onlineUsers");
const yourIdDisplay = document.getElementById("yourIdDisplay");

const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const pc = new RTCPeerConnection(configuration);

// Generate a random ID for the user
const yourId = Math.random().toString(36).substr(2, 9);
yourIdDisplay.innerText = yourId;

const socket = new WebSocket("https://worker-floral-voice-f21f.justaplayground.workers.dev/");
socket.addEventListener("open", () => {
    // Register with the signaling server
    socket.send(JSON.stringify({
        type: "register",
        id: yourId
    }));
});

socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "online-users") {
        // Update the list of online users
        onlineUsersDiv.innerHTML = "";
        msg.users.forEach(userId => {
            if (userId !== yourId) {
                const userDiv = document.createElement("div");
                userDiv.className = "user";
                userDiv.innerText = userId;
                userDiv.addEventListener("click", () => startCall(userId));
                onlineUsersDiv.appendChild(userDiv);
            }
        });
    } else if (msg.type === "offer") {
        localStorage.setItem("incomingOffer", JSON.stringify(msg.offer));
        if (confirm("Incoming call from " + msg.from + "! Accept?")) {
            answerCall(msg.from, msg.offer);
        }
    } else if (msg.type === "answer") {
        pc.setRemoteDescription(msg.answer);
    } else if (msg.type === "ice-candidate") {
        pc.addIceCandidate(msg.candidate);
    }
});

async function startCall(targetId) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    yourVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({
        type: "offer",
        target: targetId,
        offer: offer
    }));
}

async function answerCall(fromId, offer) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    yourVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.send(JSON.stringify({
        type: "answer",
        target: fromId,
        answer: answer
    }));
}

pc.onicecandidate = (event) => {
    if (event.candidate) {
        socket.send(JSON.stringify({
            type: "ice-candidate",
            target: localStorage.getItem("currentTargetId"),
            candidate: event.candidate
        }));
    }
};

pc.ontrack = (event) => {
    remoteStream.addTrack(event.track);
};
