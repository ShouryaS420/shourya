// server/routers/activities.js
import express from 'express';
import { getUserRecentActivities } from '../controllers/Activities.js';

const router = express.Router();

// GET /api/activities/user/:userId?limit=20
router.get('/user/:userId', getUserRecentActivities);

export default router;
