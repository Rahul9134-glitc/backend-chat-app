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


    // 1. Listen for when a user starts typing
    socket.on("typing", ({ receiverId }) => {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            // Send 'displayTyping' ONLY to the specific receiver
            socket.to(receiverSocketId).emit("displayTyping", { senderId: userId });
        }
    });


    socket.on("stopTyping", ({ receiverId }) => {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            // Send 'hideTyping' ONLY to the specific receiver
            socket.to(receiverSocketId).emit("hideTyping");
        }
    });


    socket.on("markAsSeen", async ({ senderId, recieverId }) => {
    const senderSocketId = userSocketMap[senderId];
    
    if (senderSocketId) {
        io.to(senderSocketId).emit("messagesSeenByReceiver", { recieverId });
    }
});


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