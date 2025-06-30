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

let rooms = {}; // Holds game state per room

function generateBoard() {
  const colors = [
    "red", "blue", "green", "orange", "purple", "pink",
    "yellow", "brown", "cyan", "magenta", "lime", "maroon",
    "navy", "olive", "teal"
  ];
  return colors.map((color, i) => ({
    id: i,
    color,
    top: Math.floor(Math.random() * 350) + "px",
    left: Math.floor(Math.random() * 350) + "px",
    eaten: false
  }));
}

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

  socket.on("poison-selected", ({ roomCode, poisonId }) => {
    const room = rooms[roomCode];
    if (!room || room.gameOver) return;

    if (!room.poison.first) {
      room.poison.first = { id: socket.id, poisonId };
      const secondPlayer = room.players.find(p => p.id !== socket.id);
      if (secondPlayer) {
        io.to(secondPlayer.id).emit("poison-select", room.board);
      }
    } else if (!room.poison.second && socket.id !== room.poison.first.id) {
      room.poison.second = { id: socket.id, poisonId };

      // Both poisons selected — start game
      io.to(roomCode).emit("start-game", {
        board: room.board,
        turn: room.turn
      });
    }
  });

  socket.on("candy-clicked", ({ roomCode, candyId }) => {
    const room = rooms[roomCode];
    if (!room || room.gameOver) return;

    if (socket.id !== room.turn) return;

    const candyIndex = room.board.findIndex(c => c.id === candyId);
    if (candyIndex === -1 || room.board[candyIndex].eaten) return;

    const isOpponentPoison =
      (room.poison.first.poisonId === candyId && socket.id !== room.poison.first.id) ||
      (room.poison.second.poisonId === candyId && socket.id !== room.poison.second.id);

    if (isOpponentPoison) {
      room.gameOver = true;
      const loser = socket.id;
      const winner = room.players.find(p => p.id !== loser).id;

      io.to(loser).emit("game-over", "You lost!");
      io.to(winner).emit("game-over", "You win!");
      return;
    }

    // Candy eaten
    room.board[candyIndex].eaten = true;

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

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
