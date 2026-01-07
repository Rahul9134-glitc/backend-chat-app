import express, { json } from "express";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
const app = express();
config({ path: "./config/config.env" });
import userRouter from "./routes/user.routes.js";
import MessageRouter from "./routes/message.routes.js"


app.use(
  cors({
    origin: [process.env.FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT"],
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : "./temp/"
}))


app.use("/api/v1/users" , userRouter);
app.use("/api/v1/message" , MessageRouter);


export default app;




