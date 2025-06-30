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

let rooms = {}; // roomCode => { players: [socket.id], poison: {}, names: {} }

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (roomCode, name) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        poison: {},
        names: {}
      };
    }

    const room = rooms[roomCode];

    // Limit to 2 players
    if (room.players.length >= 2) {
      socket.emit("room-full");
      return;
    }

    room.players.push(socket.id);
    room.names[socket.id] = name;
    socket.join(roomCode);

    console.log(`Player ${name} joined room ${roomCode}`);

    // Notify both players when 2 have joined
    if (room.players.length === 2) {
      io.to(roomCode).emit("player-joined");
    }
  });

  socket.on("select-poison", (roomCode, index) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.poison[socket.id] = index;

    // Notify opponent that this player selected poison
    socket.to(roomCode).emit("opponent-selected-poison");

    // When both selected, start game
    if (
      room.players.length === 2 &&
      room.poison[room.players[0]] !== undefined &&
      room.poison[room.players[1]] !== undefined
    ) {
      io.to(roomCode).emit("start-game");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const code in rooms) {
      const room = rooms[code];
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        delete room.names[socket.id];
        delete room.poison[socket.id];

        // If no one left, delete the room
        if (room.players.length === 0) {
          delete rooms[code];
        }
        break;
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
