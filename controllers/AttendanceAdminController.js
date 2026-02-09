import AttendanceLocation from "../models/AttendanceLocation.js";
import AttendanceSession from "../models/AttendanceSession.js";
import VendorUsers from "../models/VendorUsers.js";
import { haversineMeters } from "../utils/geo.js";

const parseDateKey = (s) => {
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
    return String(s);
};

const addDays = (dateKey, days) => {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-CA");
};

export const listLocations = async (req, res) => {
    const active = String(req.query.isActive || "") === "true";
    const q = active ? { active: true } : {};
    const locations = await AttendanceLocation.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, locations });
};

export const createLocation = async (req, res) => {
    const { type, name, lat, lng, radiusM, address } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))
        return res.status(400).json({ success: false, message: "Invalid lat/lng" });

    const r = Number(radiusM);
    if (!Number.isFinite(r) || r < 50) return res.status(400).json({ success: false, message: "radiusM must be >= 50" });

    const doc = await AttendanceLocation.create({
        type: (type || "SITE").toUpperCase(),
        name: name.trim(),
        lat: Number(lat),
        lng: Number(lng),
        radiusM: r,
        address: address || "",
        active: true,
    });

    return res.json({ success: true, location: doc });
};

export const patchLocation = async (req, res) => {
    const { id } = req.params;
    const patch = req.body || {};

    const allowed = {};
    if (patch.name != null) allowed.name = String(patch.name).trim();
    if (patch.address != null) allowed.address = String(patch.address);
    if (patch.type != null) allowed.type = String(patch.type).toUpperCase();
    if (patch.isActive != null) allowed.isActive = !!patch.isActive;

    if (patch.lat != null) allowed.lat = Number(patch.lat);
    if (patch.lng != null) allowed.lng = Number(patch.lng);
    if (patch.radiusM != null) allowed.radiusM = Number(patch.radiusM);

    const updated = await AttendanceLocation.findByIdAndUpdate(id, allowed, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Location not found" });

    return res.json({ success: true, location: updated });
};

// Admin: Update vendor attendance settings (matches your VendorDetails.js PATCH)
export const patchVendorAttendanceConfig = async (req, res) => {
    const { vendorId } = req.params;
    const { isRestricted, restrictionReason, assignedLocationIds, payroll } = req.body || {};

    const vendor = await VendorUsers.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: "Employee not found" });

    vendor.isRestricted = !!isRestricted;
    vendor.restrictionReason = restrictionReason || "";

    if (Array.isArray(assignedLocationIds)) {
        vendor.assignedLocationIds = assignedLocationIds.filter(Boolean);
    }

    if (payroll && typeof payroll === "object") {
        vendor.payroll = {
            ...(vendor.payroll?.toObject ? vendor.payroll.toObject() : vendor.payroll),
            ...payroll,
        };
    }

    await vendor.save();
    return res.json({ success: true });
};

export const listSessions = async (req, res) => {
    const vendorId = req.query.vendorId;
    const from = parseDateKey(req.query.from);
    const to = parseDateKey(req.query.to);

    if (!vendorId) return res.status(400).json({ success: false, message: "vendorId is required" });
    if (!from || !to) return res.status(400).json({ success: false, message: "from/to (YYYY-MM-DD) required" });
    if (from > to) return res.status(400).json({ success: false, message: "from must be <= to" });

    const sessions = await AttendanceSession.find({
        vendorId,
        dateKey: { $gte: from, $lte: to },
    })
        .sort({ dateKey: 1 })
        .lean();

    return res.json({ success: true, sessions });
};

// Optional: payroll preview for admin UI
export const payrollPreview = async (req, res) => {
    const vendorId = req.query.vendorId;
    const from = parseDateKey(req.query.from);
    const to = parseDateKey(req.query.to);

    if (!vendorId) return res.status(400).json({ success: false, message: "vendorId is required" });
    if (!from || !to) return res.status(400).json({ success: false, message: "from/to required" });

    const vendor = await VendorUsers.findById(vendorId).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Employee not found" });

    const sessions = await AttendanceSession.find({
        vendorId,
        dateKey: { $gte: from, $lte: to },
        status: { $in: ["OPEN", "CLOSED", "AUTO_CLOSED"] },
    }).lean();

    const payroll = vendor.payroll || {};
    const minHalf = Number(payroll.minHalfDayMins || 240);
    const minFull = Number(payroll.minFullDayMins || 480);

    let totalMins = 0;
    let presentDays = 0;
    let fullDays = 0;
    let halfDays = 0;

    // count present based on sessions existing (and mins)
    for (const s of sessions) {
        presentDays += 1;
        const mins = Number(s.durationMins || 0);
        totalMins += mins;

        if (mins >= minFull) fullDays += 1;
        else if (mins >= minHalf) halfDays += 1;
    }

    const salaryType = payroll.salaryType || "MONTHLY";
    const monthlySalary = Number(payroll.monthlySalary || 0);
    const perDayRate = Number(payroll.perDayRate || 0);
    const hourlyRate = Number(payroll.hourlyRate || 0);
    const otRate = Number(payroll.overtimeHourlyRate || 0);

    // Simple, understandable calculation:
    // - MONTHLY: estimate per-day = monthly/26, then multiply by (fullDays + halfDays*0.5)
    // - DAILY: pay perDayRate * (fullDays + halfDays*0.5)
    // - HOURLY: hourlyRate * totalHours + overtime (optional)
    const units = fullDays + halfDays * 0.5;
    const totalHours = totalMins / 60;

    let basePay = 0;
    let overtimePay = 0;

    if (salaryType === "MONTHLY") {
        const perDay = monthlySalary > 0 ? monthlySalary / 26 : 0;
        basePay = perDay * units;
    } else if (salaryType === "DAILY") {
        basePay = perDayRate * units;
    } else {
        basePay = hourlyRate * totalHours;
        // naive OT: anything above (presentDays * minFull) minutes is OT
        const otMins = Math.max(0, totalMins - presentDays * minFull);
        overtimePay = (otMins / 60) * otRate;
    }

    const gross = Math.round(basePay + overtimePay);

    return res.json({
        success: true,
        range: { from, to },
        stats: { presentDays, fullDays, halfDays, totalMins, totalHours: Number(totalHours.toFixed(2)) },
        payroll: { salaryType, monthlySalary, perDayRate, hourlyRate, overtimeHourlyRate: otRate },
        amount: { basePay: Math.round(basePay), overtimePay: Math.round(overtimePay), gross },
    });
};
