// routes/interviewRoute.js
import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  startInterview,
  getQuestion,
  submitInterviewForEvaluation,
  getInterviewHistory
} from '../controllers/interviewController.js';

const router = express.Router();

router.post('/start', authenticate, startInterview);
router.post('/question', authenticate, getQuestion);
router.post('/evaluate', authenticate, submitInterviewForEvaluation);
router.get('/history', authenticate, getInterviewHistory);

export default router;
