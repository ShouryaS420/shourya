import express from "express";
import { isAuthenticated } from "../middleware/auth.js";
import {
    createVisit,
    listMyVisits,
    getMyVisit,
    updateMyVisit,
    assignVendor,
    saveVendorInputs,
    upsertReport,
    listAssignedVisits,
} from "../controllers/SiteVisitController.js";

const router = express.Router();

router.use(isAuthenticated);

// client app
router.post("/", createVisit);
router.get("/", listMyVisits);
router.get("/:id", getMyVisit);
router.patch("/:id", updateMyVisit);

// ops / vendor flows (you can protect with role middleware later)
router.post("/:id/assign", assignVendor);
router.post("/:id/vendor-inputs", saveVendorInputs);

// admin verifies or updates report
router.post("/:id/report", upsertReport);

// partner app (Field Executive) — list visits assigned to a vendor
router.get("/assigned", listAssignedVisits);

export default router;
