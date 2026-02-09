import express from "express";
// import requireAdminAuth from "../middleware/adminAuth/requireAdminAuth.js";
import {
    listLocations,
    createLocation,
    patchLocation,
    listSessions,
    patchVendorAttendanceConfig,
    payrollPreview,
} from "../controllers/AttendanceAdminController.js";
import { requireAdminAuth } from "../middleware/adminAuth/requireAdminAuth.js";

const r = express.Router();

// All admin attendance routes should be protected
// r.use(requireAdminAuth);

// Locations
r.get("/locations", listLocations);
r.post("/locations", createLocation);
r.patch("/locations/:id", patchLocation);

// Sessions
r.get("/sessions", listSessions);

// Vendor attendance config (matches frontend)
r.patch("/vendors/:vendorId/attendance", patchVendorAttendanceConfig);

// Optional payroll preview
r.get("/payroll/preview", payrollPreview);

export default r;
