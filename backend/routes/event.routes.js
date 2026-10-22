import express from 'express';
import {
    createEvent,
    listEvents,
    getEvent,
    updateEvent,
    deleteEvent,
    addJudge,
    removeJudge
} from '../controller/event.controller.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createEventSchema, updateEventSchema, assignJudgeSchema } from '../schema/event.schema.js';

const router = express.Router();

// everything here needs a logged-in user
router.use(protect);

// organizer-only from here on
router.post('/', requireRole('organizer'), validate(createEventSchema), createEvent);
router.get('/', listEvents);                       // role filter happens in the controller
router.get('/:id', getEvent);
router.put('/:id', requireRole('organizer'), validate(updateEventSchema), updateEvent);
router.delete('/:id', requireRole('organizer'), deleteEvent);

// judge assignment
router.post('/:id/judges', requireRole('organizer'), validate(assignJudgeSchema), addJudge);
router.delete('/:id/judges/:judgeId', requireRole('organizer'), removeJudge);

export default router;
