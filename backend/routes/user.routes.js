import express from 'express';
import { listJudges } from '../controller/user.controller.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// only organizers assign judges, so only they need the list
router.get('/judges', protect, requireRole('organizer'), listJudges);

export default router;
