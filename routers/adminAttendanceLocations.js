// routes/adminAttendanceLocations.js
import express from "express";
import {
    listLocations,
    createLocation,
    updateLocation,
    deactivateLocation,
} from "../controllers/AdminAttendanceLocationController.js";

const r = express.Router();

r.get("/locations", listLocations);
r.post("/locations", createLocation);

// ✅ FIXED PATHS
r.patch("/locations/:id", updateLocation);
r.delete("/locations/:id", deactivateLocation);

export default r;
