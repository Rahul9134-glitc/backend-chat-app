import catchAsyncError from "../middleware/catchErrorasyncHandler.js";
import { Message } from "../models/message.models.js";
import { User } from "../models/user.models.js";
import cloudinary from "cloudinary";
import { getReceiverSocketId, io } from "../utils/socket.io.js";

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const loggedInUserId = req.user._id;
  const users = await User.find({
    _id: { $ne: loggedInUserId },
  }).select("-password");

  return res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    users,
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
  // --- FIX 1: Safety check for req.body ---
  const body = req.body || {};
  const { text } = body;

  // --- FIX 2: Safety check for express-fileupload ---
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

  let mediaUrl = "";

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
      mediaUrl = uploadResponse?.secure_url;
    } catch (error) {
      console.error("Cloudinary Error:", error);
      return res.status(500).json({ success: false, message: "Failed to upload media" });
    }
  }

  const newMessage = await Message.create({
    senderId,
    recieverId,
    text: sanitizedText,
    media: mediaUrl,
    seen: false // Default false
  });

  // --- SOCKET LOGIC ---
  const recieverSocketId = getReceiverSocketId(recieverId);
  if (recieverSocketId) {
    // Note: Hum sirf receiver ko bhej rahe hain (io.to)
    // Sender ko Redux response se message mil jayega
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