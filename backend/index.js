import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';




// config 
dotenv.config();



// express app
const app = express();

// middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_URL }));

// health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'HackJudge AI API' });
});

// routes
app.use('/api/auth',authRoutes);




// PORT

const PORT = process.env.PORT || 5000;



// database connection
connectDB();





// listener
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});