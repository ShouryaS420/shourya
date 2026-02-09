import express from "express";
// import { isAuthenticated } from "../middleware/auth.js";     // your existing user auth
// import { isAdmin } from "../middleware/isAdmin.js";
import { listReports, getReport, verifyReport } from "../controllers/AdminSiteVisitController.js";

const router = express.Router();

router.get("/site-visits", listReports);
router.get("/site-visits/:id", getReport);
router.post("/site-visits/:id/verify", verifyReport);

export default router;
