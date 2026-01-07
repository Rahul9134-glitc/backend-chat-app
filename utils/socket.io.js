import { Server } from "socket.io";

const userSocketMap = {}; 
let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173", 
      methods: ["GET", "POST"],
      credentials: true
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    
    if (userId && userId !== "undefined") {
      userSocketMap[userId] = socket.id;
      console.log(`User ${userId} connected with socket ${socket.id}`);
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      if (userId && userId !== "undefined") {
        delete userSocketMap[userId];
        console.log(`User ${userId} disconnected`);
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
      }
    });
  });

  return io;
}

export const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
};

export { io };