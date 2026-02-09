import mongoose from "mongoose";
import AttendanceLocation from "../models/AttendanceLocation.js";
import AttendanceSession from "../models/AttendanceSession.js";
import VendorUsers from "../models/VendorUsers.js";
import { haversineMeters, toDateKey } from "../utils/geo.js";

/**
 * Phase 3B (Vendor Attendance)
 * ✅ Enforce: project scope + (optional) assignment
 * ❌ Remove: geofence/allowed-location BLOCKING for check-in / check-out / switch
 * ✅ Keep: distance/radius meta for logs + analytics
 * ✅ Keep: restriction + selfie required + checkout time rule
 */

// ------------------
// helpers
// ------------------
const num = (v) => {
    const n = typeof v === "string" ? Number(v.trim()) : Number(v);
    return Number.isFinite(n) ? n : null;
};

const minutesFromHHMM = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = String(hhmm).split(":").map((x) => parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const minutesNowIST = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date());

    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);

    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const pushFlag = (flags, f) => {
    if (!f) return flags;
    if (!flags.includes(f)) flags.push(f);
    return flags;
};

/**
 * Ray-casting point-in-polygon.
 * polygon: [{lat,lng}, ...]
 * (kept for meta/debug; not blocking)
 */
const pointInPolygon = (lat, lng, polygon = []) => {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = Number(polygon[i].lat);
        const yi = Number(polygon[i].lng);
        const xj = Number(polygon[j].lat);
        const yj = Number(polygon[j].lng);

        const intersect =
            yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi + 0.0) + xi;

        if (intersect) inside = !inside;
    }
    return inside;
};

const withinLocationRadius = ({ lat, lng, loc }) => {
    const lLat = num(loc?.lat);
    const lLng = num(loc?.lng);
    const radiusM = num(loc?.radiusM) ?? 150;

    if (lLat == null || lLng == null) return { distanceM: null, radiusM, within: false };

    const distanceM = haversineMeters(lat, lng, lLat, lLng);
    return { distanceM, radiusM, within: distanceM <= radiusM };
};

const canCheckoutNow = (shiftEndHHMM, openOffsetMins = 2) => {
    if (!shiftEndHHMM) return true;

    const shiftEndM = minutesFromHHMM(shiftEndHHMM);
    if (shiftEndM == null) return true;

    const nowMins = minutesNowIST();
    if (nowMins == null) return true;

    return nowMins >= shiftEndM + openOffsetMins;
};

// ------------------
// Phase 3B policy
// ------------------
// If vendor.attendancePolicy.requireAssignment === false -> allow any project location (no assignment check).
// Default is TRUE (assignment required) for safety/backward-compatibility.
const mustRequireAssignment = (vendor) => vendor?.attendancePolicy?.requireAssignment !== false;

// Resolve location securely:
// - If vendor.projectId exists: enforce that exact projectId
// - If vendor.projectId is null: allow ONLY locations where projectId is null or missing
// - Assignment check stays optional (vendor.attendancePolicy.requireAssignment)
async function resolveLocationForVendor({ vendor, locationId }) {
    const projectId = vendor?.projectId ?? null;

    if (!locationId) {
        return { loc: null, err: { status: 400, message: "locationId is required (select your site/plot)." } };
    }

    const requireAssignment = mustRequireAssignment(vendor);

    if (requireAssignment) {
        const assignedIds = (vendor.assignedLocationIds || []).map(String).filter(Boolean);
        if (!assignedIds.length) {
            return {
                loc: null,
                err: { status: 403, message: "No locations assigned. Contact admin to assign your site/office." },
            };
        }
        if (!assignedIds.includes(String(locationId))) {
            return { loc: null, err: { status: 403, message: "Selected location is not assigned to you." } };
        }
    }

    // ✅ project scope: if vendor.projectId is null, match null/missing projectId in location
    const projectScope =
        projectId != null
            ? { projectId: String(projectId) }
            : { $or: [{ projectId: null }, { projectId: { $exists: false } }] };

    const loc = await AttendanceLocation.findOne({
        _id: locationId,
        isActive: true,
        ...projectScope,
    }).lean();

    if (!loc) return { loc: null, err: { status: 400, message: "Invalid location for your project." } };
    if (loc.type === "COMMUNITY") {
        return { loc: null, err: { status: 400, message: "Please select a Plot/Site (not Community)." } };
    }

    return { loc, err: null };
}

// distance/radius meta for logs only (never blocks)
function computeDistanceMeta({ lat, lng, loc }) {
    const nLat = num(lat);
    const nLng = num(lng);
    if (nLat == null || nLng == null) return { distanceM: null, radiusM: null, within: null };

    const lLat = num(loc?.lat);
    const lLng = num(loc?.lng);
    const radiusM = num(loc?.radiusM) ?? 150;

    if (lLat == null || lLng == null) return { distanceM: null, radiusM, within: null };

    const distanceM = haversineMeters(nLat, nLng, lLat, lLng);
    const dist = Number.isFinite(distanceM) ? Math.round(distanceM) : null;

    return { distanceM: dist, radiusM, within: dist != null ? dist <= radiusM : null };
}

// ------------------
// endpoints
// ------------------
export const getMeAttendanceConfig = async (req, res) => {
    const vendorId = req.vendor?._id;

    const vendor = await VendorUsers.findById(vendorId).populate("assignedLocationIds").lean();
    if (!vendor) return res.status(404).json({ success: false, message: "User not found" });

    const assigned = (vendor.assignedLocationIds || []).filter((l) => l && l.isActive);

    // Build community → plots tree for better mobile UX
    const plotItems = assigned.filter((l) => l.type === "PLOT");
    const communityIds = [
        ...new Set(plotItems.map((p) => (p.parentCommunityId ? String(p.parentCommunityId) : "")).filter(Boolean)),
    ];

    const communities = communityIds.length
        ? await AttendanceLocation.find({ _id: { $in: communityIds }, isActive: true }).lean()
        : [];

    const groupedCommunities = communities.map((c) => ({
        _id: c._id,
        type: c.type,
        name: c.name,
        address: c.address,
        lat: c.lat,
        lng: c.lng,
        radiusM: c.radiusM,
        polygon: c.polygon || [],
        plots: plotItems
            .filter((p) => String(p.parentCommunityId || "") === String(c._id))
            .map((p) => ({
                _id: p._id,
                type: p.type,
                name: p.name,
                plotNo: p.plotNo || "",
                address: p.address,
                lat: p.lat,
                lng: p.lng,
                radiusM: p.radiusM,
                parentCommunityId: p.parentCommunityId,
            })),
    }));

    // Standalone locations (OFFICE/SITE + plots without community)
    const standalone = assigned
        .filter((l) => {
            if (l.type === "OFFICE" || l.type === "SITE") return true;
            if (l.type === "PLOT" && !l.parentCommunityId) return true;
            if (l.type === "COMMUNITY") return true; // optional assignment
            return false;
        })
        .map((l) => ({
            _id: l._id,
            type: l.type,
            name: l.name,
            plotNo: l.plotNo || "",
            parentCommunityId: l.parentCommunityId || null,
            address: l.address,
            lat: l.lat,
            lng: l.lng,
            radiusM: l.radiusM,
            polygon: l.polygon || [],
            isActive: l.isActive,
        }));

    return res.json({
        success: true,
        vendor: {
            _id: vendor._id,
            username: vendor.username,
            mobile: vendor.mobile,
            role: vendor.role,
            department: vendor.department,
            projectId: vendor.projectId || null,
            isRestricted: !!vendor.isRestricted,
            restrictionReason: vendor.restrictionReason || "",
            payroll: vendor.payroll || {},
            attendancePolicy: vendor.attendancePolicy || {},
            assignedLocations: standalone,
            assignedCommunities: groupedCommunities,
        },
    });
};

export const getToday = async (req, res) => {
    const vendorId = req.vendor?._id;
    const todayKey = toDateKey(new Date());

    const shiftEnd = req.vendor?.payroll?.shiftEnd || null;
    const checkoutOpensAtMins = shiftEnd ? minutesFromHHMM(shiftEnd) + 2 : null;
    const nowMins = minutesNowIST();

    const ui = {
        canCheckoutNow: checkoutOpensAtMins == null ? true : nowMins >= checkoutOpensAtMins,
        checkoutOpensInMins:
            checkoutOpensAtMins != null && nowMins < checkoutOpensAtMins ? checkoutOpensAtMins - nowMins : 0,
    };

    const sessions = await AttendanceSession.find({ vendorId, dateKey: todayKey }).sort({ sessionNo: -1 }).lean();
    const openSession = sessions.find((s) => s.status === "OPEN") || null;
    const latest = sessions[0] || null;

    return res.json({
        success: true,
        dateKey: todayKey,
        session: openSession || latest || null,
        openSession,
        sessions,
        policy: {
            shiftEnd,
            checkoutOpenOffsetMins: 2,
            requireAssignment: mustRequireAssignment(req.vendor),
            geofenceBlocking: false,
        },
        ui,
    });
};

// GET /vendor/attendance/nearby?lat=..&lng=..&limit=30&maxDistanceM=5000
// GET /vendor/attendance/nearby?lat=..&lng=..&limit=30&maxDistanceM=20000
export const getNearbyLocations = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;

        // ✅ Only check active user
        const vendor = await VendorUsers.findById(vendorId).select("_id isActive").lean();
        if (!vendor) return res.status(401).json({ ok: false, message: "Unauthorized" });
        if (vendor.isActive === false) {
            return res.status(403).json({ ok: false, message: "User is inactive" });
        }

        const lat = Number(req.query.lat);
        const lng = Number(req.query.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({ ok: false, message: "Invalid GPS coordinates" });
        }

        const limitRaw = Number(req.query.limit || 30);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

        const reqMax = Number(req.query.maxDistanceM || 20000); // default 20km
        const maxDistanceM = Number.isFinite(reqMax) ? Math.min(Math.max(reqMax, 250), 20000) : 20000;

        // ✅ only active site-like locations
        const geoQuery = {
            isActive: true,
            type: { $in: ["SITE", "PLOT", "OFFICE"] }, // keep SITE here
            geo: { $exists: true },                   // IMPORTANT for geoNear
        };

        const rows = await AttendanceLocation.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] },
                    distanceField: "distanceM",
                    spherical: true,
                    maxDistance: maxDistanceM,
                    query: geoQuery,
                },
            },
            { $limit: limit },
            {
                $project: {
                    _id: 1,
                    type: 1,
                    name: 1,
                    address: 1,
                    lat: 1,
                    lng: 1,
                    radiusM: 1,
                    distanceM: 1,
                },
            },
        ]);

        // decorate rounding only
        const locations = rows.map((r) => ({
            ...r,
            distanceM: Number.isFinite(r.distanceM) ? Math.round(r.distanceM) : null,
            radiusM: Number(r.radiusM || 150),
        }));

        return res.json({
            ok: true,
            gps: { lat, lng },
            limit,
            maxDistanceM,
            locations,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, message: e?.message || "Failed to fetch nearby locations" });
    }
};

/**
 * CHECK-IN
 * - locationId required (PLOT / SITE)
 * - selfieUrl required
 * - project scope enforced
 * - assignment check is optional (attendancePolicy.requireAssignment)
 * - NO geofence blocking (distance saved only)
 */
export const checkIn = async (req, res) => {
    const vendorId = req.vendor?._id;
    const { lat, lng, accuracyM, source, locationId, selfieUrl } = req.body || {};

    const vendor = await VendorUsers.findById(vendorId).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "User not found" });

    if (vendor.isRestricted) {
        return res.status(403).json({
            success: false,
            message: vendor.restrictionReason || "You are restricted by admin. Check-in blocked.",
        });
    }

    const nLat = num(lat);
    const nLng = num(lng);
    if (nLat == null || nLng == null) return res.status(400).json({ success: false, message: "Invalid lat/lng" });

    if (!selfieUrl || typeof selfieUrl !== "string" || selfieUrl.trim().length < 5) {
        return res.status(400).json({ success: false, message: "selfieUrl is required." });
    }

    const todayKey = toDateKey(new Date());

    const existingOpen = await AttendanceSession.findOne({ vendorId, dateKey: todayKey, status: "OPEN" }).lean();
    if (existingOpen) {
        return res.status(409).json({
            success: false,
            message: "You are already checked-in. Please check-out first.",
            session: existingOpen,
        });
    }

    const { loc, err } = await resolveLocationForVendor({ vendor, locationId });
    if (err) return res.status(err.status).json({ success: false, message: err.message });

    const dmeta = computeDistanceMeta({ lat: nLat, lng: nLng, loc });

    let activeCommunityId = null;
    if (loc.type === "PLOT" && loc.parentCommunityId) activeCommunityId = loc.parentCommunityId;

    const now = new Date();
    const countToday = await AttendanceSession.countDocuments({ vendorId, dateKey: todayKey });
    const sessionNo = countToday + 1;

    const flags = [];
    const acc = num(accuracyM);
    if (acc != null && acc > 80) pushFlag(flags, "LOW_ACCURACY");

    const doc = await AttendanceSession.create({
        vendorId,
        dateKey: todayKey,
        sessionNo,
        checkInAt: now,
        status: "OPEN",
        durationMins: 0,
        flags,

        activeLocationId: loc._id,
        activeCommunityId,
        checkInSelfieUrl: selfieUrl.trim(),

        checkIn: {
            lat: nLat,
            lng: nLng,
            accuracyM: acc ?? undefined,
            locationId: loc._id,
            distanceM: dmeta.distanceM ?? undefined,
            radiusM: dmeta.radiusM ?? undefined,
            withinRange: dmeta.within ?? undefined,
            source: source || "MOBILE",
        },
    });

    return res.json({
        success: true,
        session: doc,
        policy: { requireAssignment: mustRequireAssignment(vendor), geofenceBlocking: false },
    });
};

/**
 * SWITCH SITE
 * - requires OPEN session
 * - newLocationId required
 * - project scope enforced
 * - assignment check optional
 * - NO geofence blocking
 */
export const switchSite = async (req, res) => {
    const vendorId = req.vendor?._id;
    const { lat, lng, accuracyM, source, newLocationId, selfieUrl } = req.body || {};

    const vendor = await VendorUsers.findById(vendorId).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "User not found" });

    if (vendor.isRestricted) {
        return res.status(403).json({
            success: false,
            message: vendor.restrictionReason || "You are restricted by admin. Switch blocked.",
        });
    }

    const nLat = num(lat);
    const nLng = num(lng);
    if (nLat == null || nLng == null) return res.status(400).json({ success: false, message: "Invalid lat/lng" });

    if (!newLocationId) return res.status(400).json({ success: false, message: "newLocationId is required." });

    if (!selfieUrl || typeof selfieUrl !== "string" || selfieUrl.trim().length < 5) {
        return res.status(400).json({ success: false, message: "selfieUrl is required." });
    }

    const todayKey = toDateKey(new Date());

    const session = await AttendanceSession.findOne({ vendorId, dateKey: todayKey, status: "OPEN" }).sort({
        checkInAt: -1,
    });
    if (!session) return res.status(404).json({ success: false, message: "No active (OPEN) session for today" });

    const { loc, err } = await resolveLocationForVendor({ vendor, locationId: newLocationId });
    if (err) return res.status(err.status).json({ success: false, message: err.message });

    const dmeta = computeDistanceMeta({ lat: nLat, lng: nLng, loc });

    let activeCommunityId = null;
    if (loc.type === "PLOT" && loc.parentCommunityId) activeCommunityId = loc.parentCommunityId;

    const acc = num(accuracyM);

    session.switchLogs = Array.isArray(session.switchLogs) ? session.switchLogs : [];
    session.switchLogs.push({
        at: new Date(),
        fromLocationId: session.activeLocationId || session.checkIn?.locationId || null,
        toLocationId: loc._id,
        selfieUrl: selfieUrl.trim(),
        point: {
            lat: nLat,
            lng: nLng,
            accuracyM: acc ?? undefined,
            locationId: loc._id,
            distanceM: dmeta.distanceM ?? undefined,
            radiusM: dmeta.radiusM ?? undefined,
            withinRange: dmeta.within ?? undefined,
            source: source || "MOBILE",
        },
    });

    session.activeLocationId = loc._id;
    session.activeCommunityId = activeCommunityId;

    await session.save();

    return res.json({ success: true, session, policy: { geofenceBlocking: false } });
};

/**
 * CHECK-OUT
 * Phase 3B: no "allowed location" blocking.
 * ✅ Still enforces: checkout time window + selfie required + OPEN session.
 * ✅ Still logs: distance meta vs active location + optional community meta (debug only).
 */
export const checkOut = async (req, res) => {
    const vendorId = req.vendor?._id;
    const { lat, lng, accuracyM, source, selfieUrl } = req.body || {};

    const vendor = await VendorUsers.findById(vendorId).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "User not found" });

    if (vendor.isRestricted) {
        return res.status(403).json({
            success: false,
            message: vendor.restrictionReason || "You are restricted by admin. Check-out blocked.",
        });
    }

    const nLat = num(lat);
    const nLng = num(lng);
    if (nLat == null || nLng == null) return res.status(400).json({ success: false, message: "Invalid lat/lng" });

    if (!selfieUrl || typeof selfieUrl !== "string" || selfieUrl.trim().length < 5) {
        return res.status(400).json({ success: false, message: "selfieUrl is required." });
    }

    const todayKey = toDateKey(new Date());

    const session = await AttendanceSession.findOne({ vendorId, dateKey: todayKey, status: "OPEN" }).sort({
        checkInAt: -1,
    });
    if (!session) return res.status(404).json({ success: false, message: "No active (OPEN) session for today" });

    const activeLocationId = session.activeLocationId || session.checkIn?.locationId;
    if (!activeLocationId) {
        return res.status(409).json({ success: false, message: "Invalid session state (missing active location)." });
    }

    const activeLoc = await AttendanceLocation.findById(activeLocationId).lean();
    if (!activeLoc) {
        return res.status(409).json({ success: false, message: "Active location not found. Contact admin." });
    }

    // distance meta (no blocking)
    const activeCheck = withinLocationRadius({ lat: nLat, lng: nLng, loc: activeLoc });

    // optional community meta (debug; no blocking)
    let communityMeta = null;
    const communityId = session.activeCommunityId || activeLoc.parentCommunityId || null;

    if (communityId) {
        const community = await AttendanceLocation.findById(communityId).lean();
        if (community) {
            const poly = Array.isArray(community.polygon) ? community.polygon : [];
            if (poly.length >= 3) {
                const withinCommunity = pointInPolygon(nLat, nLng, poly);
                communityMeta = { method: "POLYGON", communityId: community._id, name: community.name, within: withinCommunity };
            } else {
                const communityCheck = withinLocationRadius({ lat: nLat, lng: nLng, loc: community });
                communityMeta = {
                    method: "RADIUS",
                    communityId: community._id,
                    name: community.name,
                    within: !!communityCheck.within,
                    radiusM: Math.round(communityCheck.radiusM),
                    distanceM: communityCheck.distanceM != null ? Math.round(communityCheck.distanceM) : null,
                };
            }
        }
    }

    // ⛔ STRICT CHECKOUT TIME RULE (kept)
    const checkoutAllowed = canCheckoutNow(vendor?.payroll?.shiftEnd, 2);
    if (!checkoutAllowed) {
        return res.status(403).json({
            success: false,
            code: "CHECKOUT_NOT_OPEN",
            message: `Checkout will open 2 minutes after shift end (${vendor?.payroll?.shiftEnd}).`,
            meta: { shiftEnd: vendor?.payroll?.shiftEnd, opensAfterMinutes: 2 },
        });
    }

    const now = new Date();
    const mins = Math.max(0, Math.round((now.getTime() - new Date(session.checkInAt).getTime()) / 60000));

    const flags = Array.isArray(session.flags) ? [...session.flags] : [];
    const acc = num(accuracyM);
    if (acc != null && acc > 80) pushFlag(flags, "LOW_ACCURACY");

    const minFullDayMins = num(vendor?.payroll?.minFullDayMins);
    if (minFullDayMins != null && mins < minFullDayMins) pushFlag(flags, "SHORT_SHIFT");

    session.checkOutAt = now;
    session.status = "CLOSED";
    session.durationMins = mins;
    session.flags = flags;

    session.checkOutSelfieUrl = selfieUrl.trim();

    session.checkOut = {
        lat: nLat,
        lng: nLng,
        accuracyM: acc ?? undefined,
        locationId: activeLoc._id,
        distanceM: activeCheck.distanceM != null ? Math.round(activeCheck.distanceM) : undefined,
        radiusM: activeCheck.radiusM != null ? Math.round(activeCheck.radiusM) : undefined,
        withinRange: !!activeCheck.within,
        source: source || "MOBILE",
    };

    await session.save();

    return res.json({
        success: true,
        session,
        policy: { geofenceBlocking: false },
        meta: {
            activeLocation: {
                id: activeLoc._id,
                name: activeLoc.name,
                type: activeLoc.type,
                radiusM: Math.round(activeCheck.radiusM),
                distanceM: activeCheck.distanceM != null ? Math.round(activeCheck.distanceM) : null,
                within: !!activeCheck.within,
            },
            community: communityMeta,
        },
    });
};
