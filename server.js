const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let rooms = {}; // { code: [socket1, socket2] }
let players = {}; // { socketId: { room, role } }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomCode, name) => {
    if (!rooms[roomCode]) rooms[roomCode] = [];
    if (rooms[roomCode].length >= 2) return;

    rooms[roomCode].push(socket.id);
    players[socket.id] = {
      room: roomCode,
      role: rooms[roomCode].length === 1 ? "player1" : "player2"
    };

    socket.join(roomCode);
    socket.emit("assign-role", players[socket.id].role);

    if (rooms[roomCode].length === 2) {
      io.to(roomCode).emit("player-joined");
    }
  });

  socket.on("poison-selected", (role) => {
    const player = players[socket.id];
    if (!player) return;
    io.to(player.room).emit("poison-selected", role);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const player = players[socket.id];
    if (player) {
      const room = player.room;
      rooms[room] = rooms[room].filter(id => id !== socket.id);
      if (rooms[room].length === 0) delete rooms[room];
      delete players[socket.id];
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
