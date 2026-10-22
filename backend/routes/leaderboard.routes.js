import express from 'express';
import {
    getLeaderboard,
    releaseResults,
    exportCsv
} from '../controller/leaderboard.controller.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

// mounted at /api/events/:eventId/leaderboard — mergeParams lifts :eventId
const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/', getLeaderboard);                       // sealed for non-organizers until release
router.get('/csv', exportCsv);                          // same rule, as a file
router.post('/release', requireRole('organizer'), releaseResults);

export default router;
