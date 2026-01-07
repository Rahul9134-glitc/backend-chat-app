import { catchAsyncError } from "../middleware/catchErrorasyncHandler.js";
import { User } from "../models/user.models.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import cloudinary from "cloudinary"

export const signup = catchAsyncError(async (req, res, next) => {
  const { fullname, email, password } = req.body;

  if (!fullname || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long",
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "Email already exists",
    });
  }

  const salt = await bcrypt.genSalt(10); // Standard practice
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    fullname,
    email,
    password: hashedPassword,
    avatar: {
      public_id: "",
      url: "",
    },
  });

  generateToken(user, "User registered successfully", 201, res);
});

export const signin = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and Password are required",
    });
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  generateToken(user, "User login successfully", 200, res);
});

export const signout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    })
    .json({
      success: true,
      message: "User logged out successfully",
    });
});

export const getUser = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Fetch user successfully",
    user,
  });
});

export const updateProfile = catchAsyncError(async (req, res, next) => {
  const { fullname, email } = req.body;

  if (!fullname?.trim() || !email?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Fullname and Email cannot be empty",
    });
  }

  let data = { fullname, email };
  const avatar = req.files?.avatar;

  if (avatar) {
    try {
      const oldAvatarPublicId = req.user?.avatar?.public_id;
      if (oldAvatarPublicId) {
        await cloudinary.v2.uploader.destroy(oldAvatarPublicId);
      }

      const cloudinaryResponse = await cloudinary.v2.uploader.upload(
        avatar.tempFilePath,
        {
          folder: "CHAT_APP_USER_AVATAR",
          transformation: [
            { width: 300, height: 300, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        }
      );

      data.avatar = {
        public_id: cloudinaryResponse.public_id,
        url: cloudinaryResponse.secure_url,
      };
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to Cloudinary",
      });
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, data, {
    new: true,
    runValidators: true,
  }).select("-password");

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});
