import express from 'express';
import { createGoogleMeet } from '../controllers/meetingController.js';

const router = express.Router();

router.post('/schedule-meeting', createGoogleMeet);

export default router;
