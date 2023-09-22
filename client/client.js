document.addEventListener("DOMContentLoaded", function() {
  const ws = new WebSocket('wss://worker-floral-voice-f21f.justaplayground.workers.dev/');
  const yourVideo = document.getElementById('yourVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const onlineUsersDiv = document.getElementById('onlineUsers');

  let yourId;
  let yourConnection;

  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      yourVideo.srcObject = stream;
      yourVideo.muted = true;
  });

  ws.onopen = () => {
      console.log("Connected to the signaling server");
  };

  ws.onmessage = (msg) => {
      let data = JSON.parse(msg.data);
      switch(data.type) {
          case "login":
              handleLogin(data.success);
              break;
          case "offer":
              handleOffer(data.offer, data.name);
              break;
          case "answer":
              handleAnswer(data.answer);
              break;
          case "candidate":
              handleCandidate(data.candidate);
              break;
          case "updateUsers":
              updateUsers(data.users);
              break;
          default:
              break;
      }
  };

  function send(data) {
      ws.send(JSON.stringify(data));
  }

  window.register = function() {
      yourId = document.getElementById('yourIdInput').value;
      if (yourId.length > 0) {
          send({
              type: "login",
              name: yourId
          });
      }
  };

  function handleLogin(success) {
      if (success === false) {
          alert("Login unsuccessful, please try a different name.");
      } else {
          initConnection();
      }
  }

  function updateUsers(users) {
      onlineUsersDiv.innerHTML = '';
      users.forEach(user => {
          if(user !== yourId) {
              const userDiv = document.createElement('div');
              userDiv.textContent = user;
              userDiv.className = 'user';
              userDiv.onclick = function() { startPeerConnection(user); };
              onlineUsersDiv.appendChild(userDiv);
          }
      });
  }

  function initConnection() {
      const configuration = {
          iceServers: [{ "url": "stun:stun.1.google.com:19302" }]
      };

      yourConnection = new RTCPeerConnection(configuration);

      yourConnection.onicecandidate = function (event) {
          if (event.candidate) {
              send({
                  type: "candidate",
                  candidate: event.candidate
              });
          }
      };

      const stream = yourVideo.srcObject;
      stream.getTracks().forEach(track => yourConnection.addTrack(track, stream));
  }

  function startPeerConnection(user) {
      yourConnection.createOffer(offer => {
          send({
              type: "offer",
              offer: offer
          });
          yourConnection.setLocalDescription(offer);
      }, error => {
          console.log("Error creating an offer: ", error);
      });

      yourConnection.ontrack = function(event) {
          remoteVideo.srcObject = event.streams[0];
      };
  }

  function handleOffer(offer, name) {
      yourConnection.setRemoteDescription(new RTCSessionDescription(offer));

      yourConnection.createAnswer(answer => {
          yourConnection.setLocalDescription(answer);
          send({
              type: "answer",
              answer: answer
          });
      }, error => {
          console.log("Error creating an answer: ", error);
      });
  }

  function handleAnswer(answer) {
      yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  function handleCandidate(candidate) {
      yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});
