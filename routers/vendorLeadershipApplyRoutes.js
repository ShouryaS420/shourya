// routers/vendorLeadershipApplyRoutes.js
import express from "express";
import { isVendorAuthenticated } from "../middleware/vendorUserAuth.js";
// import { applyForLeadershipProgram } from "../controllers/VendorLeadershipApplyController.js";
import { applyForLeadershipProgram, getMyLeadershipApplications } from "../controllers/VendorLeadershipApplyController.js";

const router = express.Router();

router.post("/apply", isVendorAuthenticated, applyForLeadershipProgram);
router.get("/my-applications", isVendorAuthenticated, getMyLeadershipApplications);


export default router;
