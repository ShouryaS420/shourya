import express from "express";
import { setVendorAttendancePolicy } from "../controllers/AdminVendorAttendancePolicyController.js";

const r = express.Router();

r.patch("/:vendorId/attendance-policy", setVendorAttendancePolicy);

export default r;
