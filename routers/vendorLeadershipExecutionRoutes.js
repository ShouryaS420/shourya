import express from "express";
import { isVendorAuthenticated } from "../middleware/vendorUserAuth.js";
import { leaderSubmitCompletion } from "../controllers/VendorLeadershipExecutionController.js";

const router = express.Router();

router.post("/submit", isVendorAuthenticated, leaderSubmitCompletion);

export default router;
