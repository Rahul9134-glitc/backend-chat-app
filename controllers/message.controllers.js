import catchAsyncError from "../middleware/catchErrorasyncHandler.js";
import { Message } from "../models/message.models.js";
import { User } from "../models/user.models.js";
import cloudinary from "cloudinary";
import { getReceiverSocketId, io } from "../utils/socket.io.js";

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const loggedInUserId = req.user._id;

  // 1. Aggregation Pipeline: Yeh find karega har user ke saath aapka last message kab hua
  const usersWithLastMessage = await User.aggregate([
    // Apne aap ko list se hatao
    { $match: { _id: { $ne: loggedInUserId } } },

    // Har user ke liye messages collection se last message dundo
    {
      $lookup: {
        from: "messages", // Aapke collection ka naam (model name 'Message' hai toh 'messages' hoga)
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
          { $sort: { createdAt: -1 } }, // Latest message sabse upar
          { $limit: 1 } // Sirf 1 message chahiye check karne ke liye
        ],
        as: "lastConversation"
      }
    },

    // Password field ko hatao
    { $project: { password: 0 } },

    // Sorting Logic: Jisne message kiya uska time lo, warna 0 (purane users niche)
    {
      $addFields: {
        lastMessageTime: {
          $ifNull: [{ $arrayElemAt: ["$lastConversation.createdAt", 0] }, new Date(0)]
        }
      }
    },

    // Final Sort: Latest time wala user sabse upar
    { $sort: { lastMessageTime: -1 } }
  ]);

  return res.status(200).json({
    success: true,
    message: "Users fetched successfully with recent sorting",
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