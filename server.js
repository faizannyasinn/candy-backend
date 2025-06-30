const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const rooms = {};

io.on('connection', socket => {
  socket.on('createRoom', ({ playerName }, callback) => {
    const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
    rooms[roomCode] = {
      players: [{ id: socket.id, name: playerName }],
      poison: {}
    };
    socket.join(roomCode);
    callback({ roomCode });
  });

  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    const room = rooms[roomCode];
    if (room && room.players.length === 1) {
      room.players.push({ id: socket.id, name: playerName });
      socket.join(roomCode);
      io.to(roomCode).emit('playerJoined', { players: room.players });
      callback({ success: true });
    } else {
      callback({ success: false });
    }
  });

  socket.on('choosePoison', ({ roomCode, candyIndex }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].poison[socket.id] = candyIndex;
      if (Object.keys(rooms[roomCode].poison).length === 2) {
        io.to(roomCode).emit('startTurns');
      }
    }
  });

  socket.on('chooseCandy', ({ roomCode, candyIndex }) => {
    const room = rooms[roomCode];
    const opponent = room.players.find(p => p.id !== socket.id);
    if (room.poison[opponent.id] === candyIndex) {
      io.to(socket.id).emit('gameResult', { result: 'lost' });
      io.to(opponent.id).emit('gameResult', { result: 'won' });
    } else {
      io.to(roomCode).emit('nextTurn');
    }
  });

  socket.on('disconnect', () => {
    for (let code in rooms) {
      const index = rooms[code].players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        rooms[code].players.splice(index, 1);
        io.to(code).emit('opponentLeft');
        break;
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
