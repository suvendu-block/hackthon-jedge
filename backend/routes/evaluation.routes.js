import express from 'express';
import {
    getMyEvaluation,
    saveDraft,
    submitEvaluation,
    myEvaluations
} from '../controller/evaluation.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { saveDraftSchema, submitSchema } from '../schema/evaluation.schema.js';

const router = express.Router();

router.use(protect);

// my scorecards queue
router.get('/mine', myEvaluations);

// scorecard for one submission: GET (open) / PUT (draft) / POST (submit)
router.get('/submission/:id', getMyEvaluation);
router.put('/submission/:id', validate(saveDraftSchema), saveDraft);
router.post('/submission/:id/submit', validate(submitSchema), submitEvaluation);

export default router;
