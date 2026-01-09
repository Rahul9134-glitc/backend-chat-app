import catchAsyncError from "../middleware/catchErrorasyncHandler.js";
import { Message } from "../models/message.models.js";
import { User } from "../models/user.models.js";
import cloudinary from "cloudinary";
import { getReceiverSocketId, io } from "../utils/socket.io.js";

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const loggedInUserId = req.user._id;

  const usersWithLastMessage = await User.aggregate([
    { $match: { _id: { $ne: loggedInUserId } } },
    
    // 1. Latest message fetch karna
    {
      $lookup: {
        from: "messages",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $and: [{ $eq: ["$senderId", "$$userId"] }, { $eq: ["$recieverId", loggedInUserId] }] },
                  { $and: [{ $eq: ["$senderId", loggedInUserId] }, { $eq: ["$recieverId", "$$userId"] }] }
                ]
              }
            }
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 }
        ],
        as: "lastConversation"
      }
    },

    // 2. Unread messages count karna (Jo samne wale ne bheje par maine nahi dekhe)
    {
      $lookup: {
        from: "messages",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$senderId", "$$userId"] },
                  { $eq: ["$recieverId", loggedInUserId] },
                  { $eq: ["$seen", false] }
                ]
              }
            }
          }
        ],
        as: "unreadMessages"
      }
    },

    // Sirf wahi users dikhao jinse baat hui hai (Active Chats)
    { $match: { "lastConversation": { $ne: [] } } },

    { $project: { password: 0 } },

    // 3. Data ko clean format mein convert karna
    {
      $addFields: {
        lastMessage: { $arrayElemAt: ["$lastConversation", 0] },
        unreadCount: { $size: "$unreadMessages" },
        lastMessageTime: { $arrayElemAt: ["$lastConversation.createdAt", 0] }
      }
    },

    { $sort: { lastMessageTime: -1 } }
  ]);

  return res.status(200).json({
    success: true,
    message: "Active chats fetched successfully",
    users: usersWithLastMessage,
  });
});

export const getMessage = catchAsyncError(async (req, res, next) => {
  const recieverId = req.params.id;
  const myId = req.user.id; // Fixed: req.user.id ki jagah _id use karein consistent rehne ke liye

  const messages = await Message.find({
    $or: [
      { senderId: myId, recieverId: recieverId },
      { senderId: recieverId, recieverId: myId },
    ],
  }).sort({ createdAt: 1 });

  return res.status(200).json({
    success: true,
    message: "Messages fetched successfully",
    messages,
  });
});

export const sendMessage = catchAsyncError(async (req, res, next) => {
  const body = req.body || {};
  const { text } = body;
  const media = req.files ? req.files.media : null;
  
  const { id: recieverId } = req.params;
  const senderId = req.user._id;

  const receiver = await User.findById(recieverId);
  if (!receiver) {
    return res.status(404).json({ success: false, message: "Receiver not found" });
  }

  const sanitizedText = text?.trim() || "";

  if (!sanitizedText && !media) {
    return res.status(400).json({
      success: false,
      message: "Cannot send an empty message",
    });
  }

  let mediaData = null; 

  if (media) {
    try {
      const uploadResponse = await cloudinary.v2.uploader.upload(
        media.tempFilePath,
        {
          resource_type: "auto",
          folder: "CHAT-APP-MEDIA",
          transformation: [
            { width: 1080, height: 1080, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        }
      );
      
      mediaData = {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      };
    } catch (error) {
      console.error("Cloudinary Error:", error);
      return res.status(500).json({ success: false, message: "Failed to upload media" });
    }
  }

  const newMessage = await Message.create({
    senderId,
    recieverId,
    text: sanitizedText,
    media: mediaData, 
    seen: false
  });

  const recieverSocketId = getReceiverSocketId(recieverId);
  if (recieverSocketId) {
    io.to(recieverSocketId).emit("newMessage", newMessage);
  }

  return res.status(201).json({
    success: true,
    message: "Message sent successfully",
    newMessage,
  });
});

export const markMessagesAsSeen = catchAsyncError(async (req, res) => {
  const { id: userToChatId } = req.params; 
  const myId = req.user._id;

  await Message.updateMany(
    { senderId: userToChatId, recieverId: myId, seen: false },
    { $set: { seen: true } }
  );

  res.status(200).json({ success: true, message: "Messages marked as seen" });
});


export const addReaction = catchAsyncError(async (req, res) => {
  const { messageId, emoji } = req.body;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) {
    return res.status(404).json({ success: false, message: "Message not found" });
  }

  const existingIndex = message.reactions.findIndex(
    (r) => r.userId.toString() === userId.toString()
  );

  let actionType = ""; 

  if (existingIndex > -1) {
    if (message.reactions[existingIndex].emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
      actionType = "REMOVED";
    } else {
      message.reactions[existingIndex].emoji = emoji;
      actionType = "UPDATED";
    }
  } else {
    message.reactions.push({ emoji, userId });
    actionType = "ADDED";
  }

  await message.save();

  const receiverId = message.senderId.equals(userId) ? message.recieverId : message.senderId;
  const receiverSocketId = getReceiverSocketId(receiverId);
  
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("reactionUpdate", { 
      messageId, 
      emoji: actionType === "REMOVED" ? null : emoji, 
      userId,
      actionType 
    });
  }

  res.status(200).json({ 
    success: true, 
    message: "Reaction processed", 
    data: { messageId, reactions: message.reactions } 
  });
});


export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params; 
    const userId = req.user._id;

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Unauthorized: You can only delete your own messages" });
    }


    if (message.media && message.media.public_id) {
      try {
        await cloudinary.v2.uploader.destroy(message.media.public_id);
        console.log("Cloudinary file deleted successfully");
      } catch (cloudinaryError) {
        console.error("Cloudinary Delete Failed:", cloudinaryError);
      }
    }

    await Message.findByIdAndDelete(id);

    res.status(200).json({ 
      success: true, 
      message: "Message deleted successfully from chat and cloud" 
    });
  } catch (error) {
    console.error("Delete Controller Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};