// routes/workerHomeRoutes.js
import express from "express";
import { isVendorAuthenticated } from "../middleware/vendorUserAuth.js";
import { getHomePersonalization } from "../controllers/WorkerPersonalizationController.js";

const router = express.Router();

// GET /api/worker/home/personalization
router.get("/worker/home/personalization", isVendorAuthenticated, getHomePersonalization);

export default router;
