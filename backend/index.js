import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';




// config 
dotenv.config();



// express app
const app = express();




// PORT

const PORT = process.env.PORT || 5000;



// database connection
connectDB();





// listener
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});