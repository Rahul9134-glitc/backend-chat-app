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

  console.log("reciever id ",recieverId);
  const myId = req.user.id;

  console.log("my id ",myId);

  const receiver = await User.findById(recieverId);

  if (!receiver) {
    return res.status(404).json({
      success: false,
      message: "Receiver not found",
    });
  }

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
  const { text } = req.body;

  const media = req?.files?.media;
  const { id: recieverId } = req.params;
  const senderId = req.user._id;

  const receiver = await User.findById(recieverId);
  if (!receiver) {
    return res.status(404).json({
      success: false,
      message: "Receiver not found",
    });
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
      return res.status(500).json({
        success: false,
        message: "Failed to upload media",
      });
    }
  }

  const newMessage = await Message.create({
    senderId,
    recieverId,
    text: sanitizedText,
    media: mediaUrl,
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
