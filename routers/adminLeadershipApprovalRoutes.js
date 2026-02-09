import express from "express";
import { requireAdminAuth } from "../middleware/adminAuth/requireAdminAuth.js";
import { requireRole } from "../middleware/adminAuth/requireRole.js";
import { adminApproveAndPostPayout } from "../controllers/AdminLeadershipApprovalController.js";

const router = express.Router();
router.post("/approve-post-payout", requireRole("admin", "founder", "ops"), adminApproveAndPostPayout);

export default router;
