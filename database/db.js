import mongoose from "mongoose";

const dbConnect = () =>{
    mongoose.connect(process.env.MONGO_URI , {
        dbName : "MERN-STACK-CHAT-APP"
    }).then(()=>{
        console.log(`Mongo DB is connnected successfully on ${process.env.MONGO_URI}`)
    }).catch((error)=>{
        console.error(error)
    });
}


export default dbConnect;