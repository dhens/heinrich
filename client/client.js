const myIdInput = document.getElementById("myId");
const targetIdInput = document.getElementById("targetId");
const statusDiv = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const callBtn = document.getElementById("callBtn");
const endBtn = document.getElementById("endBtn");

let websocket;

function startWebSocket() {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        websocket = new WebSocket('wss://worker-floral-voice-f21f.justaplayground.workers.dev');

        websocket.addEventListener('open', event => {
            console.log('Connected to the signaling server');
            setStatus("Connected to the signaling server.");
            register(myIdInput.value);
        });

        websocket.addEventListener('message', event => {
            const data = JSON.parse(event.data);
            if (data.echo) {
                console.log('Echo from server:', data.echo);
            } else {
                // Handle other types of data or messages.
            }
        });

        websocket.addEventListener('error', error => {
            console.error(`WebSocket Error: ${error}`);
        });

        websocket.addEventListener('close', event => {
            if (event.wasClean) {
                setStatus(`Closed cleanly, code=${event.code}, reason=${event.reason}`);
            } else {
                setStatus('Connection died');
            }
        });
    } else {
        console.log('WebSocket is already opened.');
    }
}

function register(myId) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ register: myId }));
    } else {
        console.error('WebSocket is not opened.');
    }
}

function callTarget() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ call: targetIdInput.value }));
    } else {
        console.error('WebSocket is not opened.');
    }
}

function setStatus(message) {
    statusDiv.textContent = message;
}

startBtn.addEventListener("click", function() {
    startWebSocket();
});

callBtn.addEventListener("click", function() {
    callTarget();
});

endBtn.addEventListener("click", function() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close(1000, "Ending call");
        setStatus("Call ended.");
    }
});
