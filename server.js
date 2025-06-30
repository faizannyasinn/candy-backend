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

let rooms = {}; // { roomCode: [player1, player2] }
let poisonSelections = {}; // { roomCode: { socketId: poisonIndex } }

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (roomCode, name) => {
    if (!rooms[roomCode]) rooms[roomCode] = [];
    rooms[roomCode].push({ id: socket.id, name });

    socket.join(roomCode);

    if (rooms[roomCode].length === 2) {
      poisonSelections[roomCode] = {};
      const [player1, player2] = rooms[roomCode];
      io.to(player1.id).emit("start-poison-selection", { isFirst: true });
      io.to(player2.id).emit("start-poison-selection", { isFirst: false });
    }
  });

  socket.on("poison-selected", ({ roomCode, poisonIndex }) => {
    if (!poisonSelections[roomCode]) poisonSelections[roomCode] = {};
    poisonSelections[roomCode][socket.id] = poisonIndex;

    if (Object.keys(poisonSelections[roomCode]).length === 2) {
      io.to(roomCode).emit("start-game");
    }
  });

  socket.on("disconnect", () => {
    for (let room in rooms) {
      rooms[room] = rooms[room].filter(p => p.id !== socket.id);
      if (rooms[room].length === 0) {
        delete rooms[room];
        delete poisonSelections[room];
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
