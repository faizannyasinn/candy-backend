const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins
    methods: ["GET", "POST"]
  }
});

let rooms = {}; // roomCode: [{ id, name }, { id, name }]

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("join-room", (roomCode, name) => {
    if (!rooms[roomCode]) rooms[roomCode] = [];

    rooms[roomCode].push({ id: socket.id, name });
    socket.join(roomCode);

    console.log(`👤 ${name} joined room ${roomCode}`);

    if (rooms[roomCode].length === 2) {
      io.to(roomCode).emit("player-joined");
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    for (const room in rooms) {
      rooms[room] = rooms[room].filter(player => player.id !== socket.id);
      if (rooms[room].length === 0) {
        delete rooms[room];
      }
    }
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
