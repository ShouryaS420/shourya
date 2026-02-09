import express from "express";
import {
    getCareerProfile,
    getCareerHistory,
    getCareerRewards
} from "../controllers/careerController.js";

const router = express.Router();

router.get("/:workerId/profile", getCareerProfile);
router.get("/:workerId/history", getCareerHistory);
router.get("/:workerId/rewards", getCareerRewards);

export default router;
