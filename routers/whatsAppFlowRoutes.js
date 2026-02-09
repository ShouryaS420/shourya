import express from "express";
import { captureSiteVisitReconfirmDecision } from "../controllers/WhatsAppFlowController.js";

const router = express.Router();

// Provider -> server callback
router.post("/site-visit/reconfirm", captureSiteVisitReconfirmDecision);

export default router;
