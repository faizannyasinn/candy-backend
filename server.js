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

let rooms = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-room", (roomCode, name) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        poisonIndex: null,
        currentTurn: null
      };
    }

    rooms[roomCode].players.push({ id: socket.id, name });
    socket.join(roomCode);

    if (rooms[roomCode].players.length === 2) {
      io.to(roomCode).emit("player-joined", rooms[roomCode].players.map(p => p.id));
    }
  });

  socket.on("poison-chosen", ({ roomCode, poisonIndex }) => {
    rooms[roomCode].poisonIndex = poisonIndex;
    rooms[roomCode].currentTurn = rooms[roomCode].players[0].id;
    io.to(roomCode).emit("poison-chosen");
  });

  socket.on("play-turn", ({ roomCode, candyIndex }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (candyIndex === room.poisonIndex) {
      const loser = socket.id;
      const winner = room.players.find(p => p.id !== loser)?.id;
      io.to(roomCode).emit("game-over", { winnerId: winner });
      delete rooms[roomCode];
    } else {
      const next = room.players.find(p => p.id !== socket.id)?.id;
      room.currentTurn = next;
      io.to(roomCode).emit("turn-played", { nextPlayerId: next });
    }
  });

  socket.on("disconnect", () => {
    for (const code in rooms) {
      rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
      if (rooms[code].players.length === 0) delete rooms[code];
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
