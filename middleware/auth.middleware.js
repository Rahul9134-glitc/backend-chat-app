import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import catchAsyncError from "./catchErrorasyncHandler.js";

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "User is not authenticated, please login",
    });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  const user = await User.findById(decoded.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  req.user = user;

  next();
});
