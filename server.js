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
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomCode, name) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        poison: {},
        turn: null,
        board: [],
        gameOver: false
      };
    }

    if (rooms[roomCode].players.length >= 2) return;

    rooms[roomCode].players.push({ id: socket.id, name });
    socket.join(roomCode);

    if (rooms[roomCode].players.length === 2) {
      const board = generateBoard();
      rooms[roomCode].board = board;
      rooms[roomCode].turn = rooms[roomCode].players[0].id;

      io.to(rooms[roomCode].players[0].id).emit("poison-select", board);
      io.to(rooms[roomCode].players[1].id).emit("wait-poison");
    }
  });

  socket.on("poison-selected", ({ roomCode, poisonIndex }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (!room.poison.first) {
      room.poison.first = { id: socket.id, index: poisonIndex };

      const secondPlayer = room.players.find(p => p.id !== socket.id);
      if (secondPlayer) {
        io.to(secondPlayer.id).emit("poison-select", room.board);
      }
    } else if (!room.poison.second && socket.id !== room.poison.first.id) {
      room.poison.second = { id: socket.id, index: poisonIndex };

      // Both poisons selected, start game
      io.to(roomCode).emit("start-game", {
        board: room.board,
        turn: room.turn
      });
    }
  });

  socket.on("candy-clicked", ({ roomCode, index }) => {
    const room = rooms[roomCode];
    if (!room || room.gameOver) return;

    if (socket.id !== room.turn) return;

    if (
      room.poison.first.index === index &&
      socket.id !== room.poison.first.id
    ) {
      room.gameOver = true;
      io.to(socket.id).emit("game-over", "You lost!");
      io.to(room.players.find(p => p.id !== socket.id).id).emit("game-over", "You win!");
      return;
    }

    if (
      room.poison.second.index === index &&
      socket.id !== room.poison.second.id
    ) {
      room.gameOver = true;
      io.to(socket.id).emit("game-over", "You lost!");
      io.to(room.players.find(p => p.id !== socket.id).id).emit("game-over", "You win!");
      return;
    }

    // Remove candy from board
    room.board[index].eaten = true;

    // Switch turn
    room.turn = room.players.find(p => p.id !== socket.id).id;
    io.to(roomCode).emit("update-board", {
      board: room.board,
      turn: room.turn
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomCode];
      }
    }
  });
});

function generateBoard() {
  const colors = [
    "red", "blue", "green", "orange", "purple", "pink",
    "yellow", "brown", "cyan", "magenta", "lime", "maroon",
    "navy", "olive", "teal"
  ];
  return colors.map((color, i) => ({
    id: i,
    color,
    eaten: false
  }));
}

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
