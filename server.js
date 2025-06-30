const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow frontend
    methods: ["GET", "POST"]
  }
});

let rooms = {}; // { roomCode: [socketId1, socketId2] }

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (roomCode) => {
    if (!rooms[roomCode]) rooms[roomCode] = [];

    rooms[roomCode].push(socket.id);
    socket.join(roomCode);

    // Notify other player if both joined
    if (rooms[roomCode].length === 2) {
      io.to(roomCode).emit("player-joined");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const room in rooms) {
      rooms[room] = rooms[room].filter(id => id !== socket.id);
      if (rooms[room].length === 0) delete rooms[room];
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
