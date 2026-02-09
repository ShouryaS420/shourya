import express from "express";
import { isVendorAuthenticated } from "../middleware/vendorUserAuth.js";
import {
    getMeAttendanceConfig,
    checkIn,
    checkOut,
    getToday,
    switchSite,
    getNearbyLocations,
} from "../controllers/AttendanceVendorController.js";

const r = express.Router();

r.use(isVendorAuthenticated);

r.get("/me", getMeAttendanceConfig);
r.get("/today", getToday);
r.get("/nearby", getNearbyLocations);

r.post("/checkin", checkIn);
r.post("/switch", switchSite);
r.post("/checkout", checkOut);

export default r;
