import app from "./app.js";
import { v2 as cloudinary } from "cloudinary";
import dbConnect from "./database/db.js";
import http from "http";
import { initSocket } from "./utils/socket.io.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

cloudinary.api
  .ping()
  .then((result) => {
    console.log("Cloudinary is connected successfully", result);
  })
  .catch((error) => {
    console.log("Something went wrong when connectsed cloudinary", error);
  });

const server = http.createServer(app);
initSocket(server);

server.listen(process.env.PORT, function () {
  console.log(
    `Server is running on ${process.env.PORT} in ${process.env.NODE_ENV} mode`
  );
});

dbConnect();
