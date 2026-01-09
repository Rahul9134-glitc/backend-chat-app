import express from "express";
import {
  signup,
  signin,
  signout,
  getUser,
  updateProfile,
  searchNewUsers,
} from "../controllers/user.controllers.js";

import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.route("/sign-up").post(signup);
router.route("/sign-in").post(signin);
router.route("/sign-out").get(isAuthenticated, signout);
router.route("/me").get(isAuthenticated, getUser);
router.route("/update-profile").put(isAuthenticated, updateProfile);
router.route("/search").get(isAuthenticated, searchNewUsers);

export default router;
