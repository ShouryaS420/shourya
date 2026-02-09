import express from "express";
import { createPublicVisit } from "../controllers/PublicSiteVisitController.js";

const router = express.Router();

// Public website booking
router.post("/", createPublicVisit);

export default router;
