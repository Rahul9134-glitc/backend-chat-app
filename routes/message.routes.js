import express from "express";
import {
  getAllUsers,
  getMessage,
  sendMessage,
} from "../controllers/message.controllers.js";

import {isAuthenticated} from "../middleware/auth.middleware.js"

const router = express.Router();


router.route("/users").get(isAuthenticated,getAllUsers)
router.route("/:id").get( isAuthenticated , getMessage)
router.route("/send/:id").post(isAuthenticated , sendMessage)


export default router;
