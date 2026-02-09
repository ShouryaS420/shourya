// routers/adminLeadershipApplicationRoutes.js
import express from "express";
import {
    adminListApplications,
    adminGetApplicationById,
    adminApproveApplication,
    adminRejectApplication,
} from "../controllers/AdminLeadershipApplicationController.js";

const router = express.Router();

router.get("/applications", adminListApplications);
router.get("/applications/:applicationId", adminGetApplicationById);
router.post("/applications/:applicationId/approve", adminApproveApplication);
router.post("/applications/:applicationId/reject", adminRejectApplication);

export default router;
