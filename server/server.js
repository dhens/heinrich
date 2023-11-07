const express = require('express');
const { Server: WebSocketServer } = require('ws');
const https = require('https');
const http = require("http");
const fs = require("fs");
const uuid = require("uuid");

const app = express();
const httpServer = http.createServer(app);
const server = https.createServer({
    key: fs.readFileSync("/etc/letsencrypt/live/talk.widesword.net/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/talk.widesword.net/fullchain.pem"),
}, app);
const wss = new WebSocketServer({ server });

let users = {};

wss.on('connection', ws => {
    const userId = uuid.v4();
    users[userId] = ws;
    ws.id = userId;

    ws.send(JSON.stringify({ type: 'your-id', id: userId }));
    broadcastOnlineUsers();

    ws.on('message', message => {
        let parsed = JSON.parse(message);

        switch (parsed.type) {
            case 'offer':
            case 'answer':
            case 'candidate':
            case 'new-chat':
                if (users[parsed.target]) {
                    users[parsed.target].send(JSON.stringify({ ...parsed, source: ws.id }));
                }
                break;
        }
    });

    ws.on('close', () => {
        delete users[ws.id];
        broadcastOnlineUsers();
    });
});

function broadcastOnlineUsers() {
    const onlineUsers = Object.keys(users);
    for (let user of onlineUsers) {
        users[user].send(JSON.stringify({ type: 'online-users', users: onlineUsers.filter(id => id !== user) }));
    }
}


const PORT_SSL = 443;
server.listen(PORT_SSL, "0.0.0.0", () => console.log(`Server started on https://0.0.0.0:${PORT_SSL}`));