// controllers/AdminAttendanceLocationController.js
import AttendanceLocation from "../models/AttendanceLocation.js";

const TYPES = ["COMMUNITY", "PLOT", "SITE", "OFFICE"];

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

// ✅ optional projectId (NOT required)
const getProjectIdOptional = (req) => {
    const projectId =
        req.admin?.projectId ||
        req.user?.projectId ||
        req.query?.projectId ||
        req.body?.projectId;

    return projectId ? String(projectId) : null;
};

// basic polygon validation
const isPointArray = (arr) =>
    Array.isArray(arr) && arr.every((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)));

const isPolygon = (arr) => isPointArray(arr) && arr.length >= 3;
const isPolygons = (arr) => Array.isArray(arr) && arr.some((pg) => isPolygon(pg));

export const listLocations = async (req, res) => {
    try {
        const projectId = getProjectIdOptional(req);
        const { type, isActive } = req.query;

        const q = {};
        if (projectId) q.projectId = projectId; // ✅ only filter if provided
        if (type) q.type = type;
        if (isActive === "true") q.isActive = true;
        if (isActive === "false") q.isActive = false;

        const rows = await AttendanceLocation.find(q).sort({ type: 1, createdAt: -1 }).lean();
        return res.json({ success: true, locations: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to list locations" });
    }
};

export const createLocation = async (req, res) => {
    try {
        const projectId = getProjectIdOptional(req); // ✅ optional

        const {
            type = "SITE",
            name,
            lat,
            lng,
            radiusM = 150,
            address = "",
            parentCommunityId = null,
            plotNo = "",
            polygon = [],
            polygons = [],
            markers = [],
            meta = {},
            attendancePolicy,
        } = req.body || {};

        if (!TYPES.includes(type)) {
            return res.status(400).json({ success: false, message: "Invalid type" });
        }

        if (!name || String(name).trim().length < 2) {
            return res.status(400).json({ success: false, message: "name required" });
        }

        // ✅ COMMUNITY rules
        if (type === "COMMUNITY") {
            const hasMulti = isPolygons(polygons);
            const hasLegacy = isPolygon(polygon);

            if (!hasMulti && !hasLegacy) {
                return res.status(400).json({
                    success: false,
                    message: "Community boundary required (polygon or polygons).",
                });
            }

            // centroid is optional; but if you pass lat/lng store it
            const nLat = toNum(lat);
            const nLng = toNum(lng);

            const doc = await AttendanceLocation.create({
                projectId,
                type,
                name: String(name).trim(),
                lat: nLat ?? undefined,
                lng: nLng ?? undefined,
                radiusM: 0,
                address: String(address || ""),
                parentCommunityId: null,
                plotNo: "",
                polygon: hasLegacy ? polygon : [],
                polygons: hasMulti ? polygons : (hasLegacy ? [polygon] : []),
                markers: isPointArray(markers) ? markers : [],
                meta: meta || {},
                attendancePolicy: attendancePolicy || undefined,
                isActive: true,
            });

            return res.json({ success: true, location: doc });
        }

        // ✅ POINT rules (SITE/PLOT/OFFICE)
        const nLat = toNum(lat);
        const nLng = toNum(lng);
        if (nLat == null || nLng == null) {
            return res.status(400).json({ success: false, message: "valid lat/lng required" });
        }

        // ✅ PLOT must have parentCommunityId
        if (type === "PLOT" && !parentCommunityId) {
            return res.status(400).json({ success: false, message: "parentCommunityId required for PLOT" });
        }

        const doc = await AttendanceLocation.create({
            projectId,
            type,
            name: String(name).trim(),
            lat: nLat,
            lng: nLng,
            radiusM: toNum(radiusM) ?? 150,
            address: String(address || ""),
            parentCommunityId: type === "PLOT" ? parentCommunityId : null,
            plotNo: type === "PLOT" ? String(plotNo || "") : "",
            polygon: [],
            polygons: [],
            markers: [],
            meta: meta || {},
            attendancePolicy: attendancePolicy || undefined,
            isActive: true,
        });

        return res.json({ success: true, location: doc });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to create location" });
    }
};

export const updateLocation = async (req, res) => {
    try {
        const projectId = getProjectIdOptional(req); // optional
        const { id } = req.params;

        const q = { _id: id };
        if (projectId) q.projectId = projectId; // ✅ only scope if provided

        const loc = await AttendanceLocation.findOne(q);
        if (!loc) return res.status(404).json({ success: false, message: "location not found" });

        const patch = req.body || {};

        if (patch.name != null) loc.name = String(patch.name).trim();
        if (patch.type != null) {
            if (!TYPES.includes(patch.type)) return res.status(400).json({ success: false, message: "Invalid type" });
            loc.type = patch.type;
        }

        if (patch.lat !== undefined) {
            const n = toNum(patch.lat);
            loc.lat = n ?? undefined;
        }
        if (patch.lng !== undefined) {
            const n = toNum(patch.lng);
            loc.lng = n ?? undefined;
        }

        if (patch.radiusM != null) {
            const n = toNum(patch.radiusM);
            if (n == null) return res.status(400).json({ success: false, message: "invalid radiusM" });
            loc.radiusM = n;
        }

        if (patch.address != null) loc.address = String(patch.address || "");
        if (patch.plotNo != null) loc.plotNo = String(patch.plotNo || "");

        if (patch.parentCommunityId !== undefined) {
            loc.parentCommunityId = patch.parentCommunityId || null;
        }

        // ✅ COMMUNITY boundaries
        if (patch.polygon != null) {
            if (!Array.isArray(patch.polygon)) return res.status(400).json({ success: false, message: "polygon must be array" });
            loc.polygon = patch.polygon;
        }

        if (patch.polygons != null) {
            if (!Array.isArray(patch.polygons)) return res.status(400).json({ success: false, message: "polygons must be array of arrays" });
            loc.polygons = patch.polygons;
        }

        if (patch.markers != null) {
            if (!Array.isArray(patch.markers)) return res.status(400).json({ success: false, message: "markers must be array" });
            loc.markers = patch.markers;
        }

        if (patch.meta != null) loc.meta = patch.meta || {};
        if (patch.attendancePolicy != null) loc.attendancePolicy = patch.attendancePolicy || loc.attendancePolicy;

        if (patch.isActive != null) loc.isActive = !!patch.isActive;

        // ✅ enforce correct structure after updates
        if (loc.type === "COMMUNITY") {
            // radius always 0 for community
            loc.radiusM = 0;

            const hasMulti = isPolygons(loc.polygons);
            const hasLegacy = isPolygon(loc.polygon);

            if (!hasMulti && hasLegacy) {
                loc.polygons = [loc.polygon];
            }
            if (!hasLegacy && hasMulti) {
                loc.polygon = loc.polygons?.[0] || [];
            }
        } else {
            // non-community must have lat/lng
            if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
                return res.status(400).json({ success: false, message: "lat/lng required for non-community locations" });
            }
            // clear community-only fields
            loc.polygon = [];
            loc.polygons = [];
            loc.markers = [];
        }

        await loc.save();
        return res.json({ success: true, location: loc });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to update location" });
    }
};

export const deactivateLocation = async (req, res) => {
    try {
        const projectId = getProjectIdOptional(req);
        const { id } = req.params;

        const q = { _id: id };
        if (projectId) q.projectId = projectId;

        const loc = await AttendanceLocation.findOne(q);
        if (!loc) return res.status(404).json({ success: false, message: "location not found" });

        loc.isActive = false;
        await loc.save();

        return res.json({ success: true, location: loc });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to deactivate location" });
    }
};
