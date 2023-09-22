document.addEventListener("DOMContentLoaded", function() {
  const myIdInput = document.getElementById("myId");
  const targetIdInput = document.getElementById("targetId");
  const statusDiv = document.getElementById("status");

  let websocket;

  function startWebSocket() {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
          websocket = new WebSocket('wss://YOUR_WORKER_URL_HERE');

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

  document.getElementById("startBtn").addEventListener("click", function() {
      startWebSocket();
  });

  document.getElementById("callBtn").addEventListener("click", function() {
      callTarget();
  });

  document.getElementById("endBtn").addEventListener("click", function() {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.close(1000, "Ending call");
          setStatus("Call ended.");
      }
  });
});

