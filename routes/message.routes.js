import express from "express";
import {
  getAllUsers,
  getMessage,
  sendMessage,
  markMessagesAsSeen,
  deleteMessage,
  addReaction
} from "../controllers/message.controllers.js";

import {isAuthenticated} from "../middleware/auth.middleware.js"

const router = express.Router();


router.route("/users").get(isAuthenticated,getAllUsers)
router.route("/:id").get( isAuthenticated , getMessage)
router.route("/send/:id").post(isAuthenticated , sendMessage)
router.route("/seen/:id").post(isAuthenticated , markMessagesAsSeen)
router.route("/delete/:id").delete(isAuthenticated ,deleteMessage )
router.route("/react").post(isAuthenticated , addReaction)


export default router;
