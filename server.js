const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;
const ROOM = "z-call";
const users = new Map();

app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
  socket.on("join-call", ({ name } = {}) => {
    const cleanName = String(name || "Guest").trim().slice(0, 32) || "Guest";
    socket.join(ROOM);
    users.set(socket.id, { name: cleanName });
    const existingUsers = [...users.entries()]
      .filter(([id]) => id !== socket.id)
      .map(([id, user]) => ({ id, name: user.name }));

    socket.emit("existing-users", existingUsers);
    socket.to(ROOM).emit("user-joined", { id: socket.id, name: cleanName });
    io.to(ROOM).emit("participant-count", users.size);
  });

  socket.on("offer", ({ to, offer } = {}) => {
    if (to && offer) io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer } = {}) => {
    if (to && answer) io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate } = {}) => {
    if (to && candidate) io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("chat-message", ({ text } = {}) => {
    const user = users.get(socket.id);
    const cleanText = String(text || "").trim().slice(0, 500);
    if (user && cleanText) io.to(ROOM).emit("chat-message", {
      name: user.name, text: cleanText, time: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    users.delete(socket.id);
    if (user) socket.to(ROOM).emit("user-left", { id: socket.id, name: user.name });
    socket.to(ROOM).emit("participant-count", users.size);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Z Call listening on port ${PORT}`);
});