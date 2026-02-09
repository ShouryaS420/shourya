// routers/vendorLeadershipProgramRoutes.js
import express from "express";
import { isVendorAuthenticated } from "../middleware/vendorUserAuth.js";
import { vendorGetLeadershipProgramById, vendorListLeadershipPrograms } from "../controllers/VendorLeadershipProgramController.js";

const router = express.Router();

router.get("/programs", isVendorAuthenticated, vendorListLeadershipPrograms);
router.get("/programs/:id", isVendorAuthenticated, vendorGetLeadershipProgramById);

export default router;
