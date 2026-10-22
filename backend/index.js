import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import userRoutes from './routes/user.routes.js';
import evaluationRoutes from './routes/evaluation.routes.js';
import { eventScoped as submissionEventRoutes, byId as submissionByIdRoutes } from './routes/submission.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';




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
// submissions: nested under their event (mergeParams lifts eventId) + standalone by id
app.use('/api/events/:eventId/submissions',submissionEventRoutes);
app.use('/api/submissions',submissionByIdRoutes);
app.use('/api/evaluations',evaluationRoutes);
app.use('/api/events',eventRoutes);
app.use('/api/users',userRoutes);

// 404 + central error handler — must come AFTER all routes
app.use(notFound);
app.use(errorHandler);




// PORT

const PORT = process.env.PORT || 5000;



// database connection
connectDB();





// listener
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});