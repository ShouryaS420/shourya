import express from "express";
import { requireAdminAuth } from "../middleware/adminAuth/requireAdminAuth.js";
import { requireRole } from "../middleware/adminAuth/requireRole.js";
import { supervisorVerifyProgram } from "../controllers/AdminLeadershipVerificationController.js";

const router = express.Router();

// allow admin/founder/ops (adjust as per your roles)
router.post("/verify", requireRole("admin", "founder", "ops"), supervisorVerifyProgram);

export default router;
