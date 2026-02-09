// controllers/VendorAttendanceController.js
import VendorUsers from "../models/VendorUsers.js";
import AttendanceSession from "../models/AttendanceSession.js";
import { upsertWorkerWorkDayFromAttendance } from "../services/workerWorkDayService.js";

const DEFAULT_RADIUS_M = 150;
const MAX_GPS_ACCURACY_M = 80;

function toRad(v) {
    return (v * Math.PI) / 180;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getISTDateKey(d = new Date()) {
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getClientIp(req) {
    const xf = req.headers["x-forwarded-for"];
    if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
    return req.ip || req.connection?.remoteAddress || "";
}

function pickNearestLocation(locations, lat, lng) {
    if (!Array.isArray(locations) || locations.length === 0) return null;
    let best = null;
    for (const loc of locations) {
        if (!loc?.isActive) continue;
        const d = haversineMeters(lat, lng, loc.lat, loc.lng);
        if (!best || d < best.distanceM) best = { loc, distanceM: d };
    }
    return best;
}

async function getNextSessionNo(vendorId, dateKey) {
    // sessionNo starts at 1
    const last = await AttendanceSession.findOne({ vendorId, dateKey })
        .sort({ sessionNo: -1 })
        .select("sessionNo");
    return (last?.sessionNo || 0) + 1;
}

export const getAttendanceLocations = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;
        if (!vendorId) return res.status(401).json({ success: false, message: "Vendor auth required" });

        const vendor = await VendorUsers.findById(vendorId)
            .select("assignedLocationIds isRestricted restrictionReason")
            .populate("assignedLocationIds");

        const locations = (vendor?.assignedLocationIds || [])
            .filter((x) => x && x.isActive)
            .map((x) => ({
                id: x._id,
                type: x.type,
                name: x.name,
                lat: x.lat,
                lng: x.lng,
                radiusM: x.radiusM ?? DEFAULT_RADIUS_M,
                address: x.address ?? "",
            }));

        return res.json({
            success: true,
            isRestricted: !!vendor?.isRestricted,
            restrictionReason: vendor?.restrictionReason || "",
            radiusPolicyDefaultM: DEFAULT_RADIUS_M,
            locations,
        });
    } catch (e) {
        console.error("getAttendanceLocations:", e);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getAttendanceStatus = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;
        if (!vendorId) return res.status(401).json({ success: false, message: "Vendor auth required" });

        const dateKey = getISTDateKey();
        const open = await AttendanceSession.findOne({
            vendorId,
            dateKey,
            status: "OPEN",
        }).select("checkInAt checkIn status dateKey sessionNo");

        if (!open) {
            return res.json({
                success: true,
                dateKey,
                isCheckedIn: false,
                openSessionId: null,
                checkInAt: null,
            });
        }

        return res.json({
            success: true,
            dateKey,
            isCheckedIn: true,
            openSessionId: open._id,
            checkInAt: open.checkInAt,
            checkIn: open.checkIn,
            sessionNo: open.sessionNo,
        });
    } catch (e) {
        console.error("getAttendanceStatus:", e);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const checkInVendor = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;
        if (!vendorId) return res.status(401).json({ success: false, message: "Vendor auth required" });

        const vendor = await VendorUsers.findById(vendorId)
            .select("isRestricted restrictionReason assignedLocationIds")
            .populate("assignedLocationIds");

        if (vendor?.isRestricted) {
            return res.status(403).json({
                success: false,
                message: vendor.restrictionReason || "You are restricted by admin.",
            });
        }

        const { lat, lng, accuracyM, selfieUrl = "", device = {} } = req.body || {};
        if (typeof lat !== "number" || typeof lng !== "number") {
            return res.status(400).json({ success: false, message: "lat/lng required" });
        }

        if (accuracyM != null && typeof accuracyM === "number" && accuracyM > MAX_GPS_ACCURACY_M) {
            return res.status(400).json({
                success: false,
                message: `GPS accuracy is too low (~${Math.round(accuracyM)}m). Please retry.`,
            });
        }

        const dateKey = getISTDateKey();

        // Prevent multiple OPEN sessions
        const existingOpen = await AttendanceSession.findOne({ vendorId, dateKey, status: "OPEN" }).select("_id");
        if (existingOpen) {
            return res.status(409).json({ success: false, message: "Already checked in (open session exists)." });
        }

        const locations = (vendor?.assignedLocationIds || []).filter(Boolean);
        if (!locations.length) {
            return res.status(400).json({
                success: false,
                message: "No allowed Office/Site locations are assigned. Contact admin.",
            });
        }

        const nearest = pickNearestLocation(locations, lat, lng);
        if (!nearest) {
            return res.status(400).json({
                success: false,
                message: "No active locations are assigned. Contact admin.",
            });
        }

        const radiusM = nearest.loc.radiusM ?? DEFAULT_RADIUS_M;
        const within = nearest.distanceM <= radiusM;

        if (!within) {
            return res.status(403).json({
                success: false,
                message: `Out of range. Move within ${radiusM}m and retry.`,
                nearest: {
                    id: nearest.loc._id,
                    name: nearest.loc.name,
                    type: nearest.loc.type,
                    radiusM,
                    distanceM: nearest.distanceM,
                    within: false,
                },
            });
        }

        const sessionNo = await getNextSessionNo(vendorId, dateKey);

        const payload = {
            vendorId,          // ✅ FIX
            dateKey,
            sessionNo,         // ✅ FIX
            status: "OPEN",
            checkInAt: new Date(),
            checkIn: {
                locationId: nearest.loc._id,
                lat,
                lng,
                accuracyM: accuracyM ?? null,
                distanceM: nearest.distanceM,
                source: "MOBILE",
            },
            flags: [],
        };

        const session = await AttendanceSession.create(payload);

        return res.json({
            success: true,
            message: "Checked in successfully",
            sessionId: session._id,
            dateKey,
            sessionNo,
            checkInAt: session.checkInAt,
            nearest: {
                id: nearest.loc._id,
                name: nearest.loc.name,
                type: nearest.loc.type,
                radiusM,
                distanceM: nearest.distanceM,
                within: true,
            },
        });
    } catch (e) {
        console.error("checkInVendor:", e);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const checkOutVendor = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;
        if (!vendorId) return res.status(401).json({ success: false, message: "Vendor auth required" });

        const dateKey = getISTDateKey();

        const open = await AttendanceSession.findOne({
            vendorId,          // ✅ FIX
            dateKey,
            status: "OPEN",
        });

        if (!open) {
            return res.status(409).json({
                success: false,
                message: "No open session found for today.",
            });
        }

        const vendor = await VendorUsers.findById(vendorId)
            .select("assignedLocationIds")
            .populate("assignedLocationIds");

        const { lat, lng, accuracyM, selfieUrl = "", device = {} } = req.body || {};
        const flags = Array.isArray(open.flags) ? [...open.flags] : [];

        let nearestMeta = null;

        if (typeof lat === "number" && typeof lng === "number") {
            const locations = (vendor?.assignedLocationIds || []).filter(Boolean);
            const nearest = pickNearestLocation(locations, lat, lng);

            if (nearest) {
                const radiusM = nearest.loc.radiusM ?? DEFAULT_RADIUS_M;
                const within = nearest.distanceM <= radiusM;
                if (!within) flags.push("OUT_OF_RANGE_CHECKOUT");

                nearestMeta = {
                    id: nearest.loc._id,
                    name: nearest.loc.name,
                    type: nearest.loc.type,
                    radiusM,
                    distanceM: nearest.distanceM,
                    within,
                };

                open.checkOut = {
                    locationId: nearest.loc._id,
                    lat,
                    lng,
                    accuracyM: accuracyM ?? null,
                    distanceM: nearest.distanceM,
                    source: "MOBILE",
                };
            } else {
                flags.push("NO_ASSIGNED_LOCATION_ON_CHECKOUT");
                open.checkOut = {
                    locationId: null,
                    lat,
                    lng,
                    accuracyM: accuracyM ?? null,
                    distanceM: null,
                    source: "MOBILE",
                };
            }
        } else {
            flags.push("NO_GPS_ON_CHECKOUT");
            open.checkOut = {
                locationId: null,
                lat: null,
                lng: null,
                accuracyM: null,
                distanceM: null,
                source: "MOBILE",
            };
        }

        open.checkOutAt = new Date();
        open.status = "CLOSED";
        open.flags = [...new Set(flags)];

        if (open.checkInAt && open.checkOutAt) {
            const mins = Math.floor((open.checkOutAt.getTime() - open.checkInAt.getTime()) / 60000);
            open.durationMins = Math.max(0, mins);
        }

        await open.save();

        // Phase 1: Engine daily record (WorkerWorkDay) upsert
        try {
            const worker = await VendorUsers.findById(vendorId).select(
                "_id defaultShift skillCategory skillLevel"
            );

            await upsertWorkerWorkDayFromAttendance({
                worker,
                dateKey,
                attendanceSessionId: open._id,
                checkInAt: open.checkInAt,
                checkOutAt: open.checkOutAt,
            });
        } catch (e) {
            // Do not block checkout if payroll engine fails
            console.error("[WorkerWorkDay] upsert failed:", e?.message || e);
        }

        return res.json({
            success: true,
            message: "Checked out successfully",
            sessionId: open._id,
            dateKey,
            sessionNo: open.sessionNo,
            checkOutAt: open.checkOutAt,
            durationMins: open.durationMins,
            flags: open.flags,
            nearest: nearestMeta,
        });
    } catch (e) {
        console.error("checkOutVendor:", e);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
