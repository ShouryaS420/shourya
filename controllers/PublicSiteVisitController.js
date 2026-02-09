import mongoose from "mongoose";
import SiteVisit from "../models/SiteVisit.js";
import User from "../models/User.js";

// Note: WhatsApp notifications are sent via cron (Option A)
//       see services/siteVisitNotificationService.js

const toBookingRef = (id) => String(id).slice(-6).toUpperCase();

function normalizeMobile(m) {
    return String(m || "").replace(/\D/g, "").slice(-10);
}
function normalizeEmail(e) {
    return String(e || "").trim().toLowerCase();
}
function safeString(v) {
    return String(v ?? "").trim();
}
function isFiniteNumber(n) {
    return typeof n === "number" && Number.isFinite(n);
}
function isObjectId(v) {
    return v instanceof mongoose.Types.ObjectId;
}

function deepClean(obj) {
    if (obj === undefined) return undefined;
    if (obj === null) return null;

    if (obj instanceof Date) return obj;
    if (Buffer.isBuffer(obj)) return obj;
    if (isObjectId(obj)) return obj;

    if (Array.isArray(obj)) return obj.map(deepClean).filter((v) => v !== undefined);
    if (typeof obj !== "object") return obj;

    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const cleaned = deepClean(v);
        if (cleaned === undefined) continue;

        if (
            cleaned &&
            typeof cleaned === "object" &&
            !Array.isArray(cleaned) &&
            !(cleaned instanceof Date) &&
            !Buffer.isBuffer(cleaned) &&
            !isObjectId(cleaned) &&
            Object.keys(cleaned).length === 0
        ) {
            continue;
        }
        out[k] = cleaned;
    }
    return out;
}

export async function createPublicVisit(req, res) {
    try {
        const body = req.body || {};

        const name = safeString(body.name);
        const mobile = normalizeMobile(body.mobile);
        const email = normalizeEmail(body.email);
        const city = safeString(body.city);
        const budget = safeString(body.budget);
        const preferredSlot = safeString(body.preferredSlot);
        const whenISO = safeString(body.whenISO);
        const address = safeString(body.address);
        const placeId = safeString(body.placeId);
        const formattedAddress = safeString(body.formattedAddress);
        const notes = safeString(body.notes);
        const siteKeyRaw = safeString(body.siteKey);

        const coords =
            body.coords && typeof body.coords === "object"
                ? { lat: body.coords.lat, lng: body.coords.lng }
                : null;

        // ---- Validations
        if (!name) return res.status(400).json({ success: false, message: "name is required" });
        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({ success: false, message: "valid 10-digit mobile is required" });
        }
        if (!whenISO) return res.status(400).json({ success: false, message: "whenISO is required" });

        const when = new Date(whenISO);
        if (Number.isNaN(+when)) return res.status(400).json({ success: false, message: "Invalid whenISO" });

        const coordsKey =
            coords && isFiniteNumber(coords.lat) && isFiniteNumber(coords.lng)
                ? `${coords.lat},${coords.lng}`
                : "";

        const effectiveSiteKey = siteKeyRaw || placeId || coordsKey || "";

        // ---- 1) Find or create user (by mobile first, then email)
        let user =
            (await User.findOne({ mobile })) ||
            (email ? await User.findOne({ email }) : null);
        const isNewLead = !user;

        const plotPatch = deepClean({
            plotLocation: formattedAddress || address || "",
            placeId: placeId || "",
            formattedAddress: formattedAddress || address || "",
            lat: coords && isFiniteNumber(coords.lat) ? coords.lat : undefined,
            lng: coords && isFiniteNumber(coords.lng) ? coords.lng : undefined,
            city: city || "",
        });

        if (!user) {
            user = await User.create(
                deepClean({
                    username: name,
                    mobile,
                    email: email || "",
                    needsProfile: true,
                    signupMethod: email ? "email" : "mobile",
                    signupIdentifier: email ? email : mobile,
                    projectType: "construction",
                    plotInformation: plotPatch,
                })
            );
        } else {
            user.username = user.username || name;
            user.email = user.email || (email || "");
            if (!user.plotInformation) user.plotInformation = {};

            if (
                Object.prototype.hasOwnProperty.call(user.plotInformation, "viewport") &&
                user.plotInformation.viewport === undefined
            ) {
                delete user.plotInformation.viewport;
            }

            for (const [k, v] of Object.entries(plotPatch)) {
                if (v !== undefined) user.plotInformation[k] = v;
            }
            await user.save();
        }

        // Block if already active
        const active = await SiteVisit.findOne({
            userId: user._id,
            status: { $in: ["requested", "scheduled", "upcoming", "confirmed", "in_progress"] },
        }).lean();

        if (active) {
            return res.status(409).json({
                success: false,
                message: "You already have an active site visit request. Our team will connect with you shortly.",
                visit: active,
            });
        }

        // Prevent duplicates (per user + siteKey)
        if (effectiveSiteKey) {
            const existing = await SiteVisit.findOne({
                userId: user._id,
                siteKey: effectiveSiteKey,
                status: { $nin: ["cancelled"] },
            }).lean();

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "You already have a site visit booked for this location.",
                    visit: existing,
                });
            }
        }

        // ---- Timings (Option A)
        const WELCOME_DELAY_SEC = parseInt(process.env.SITEVISIT_WELCOME_DELAY_SEC || "150", 10);
        const RECONFIRM_AFTER_WELCOME_SEC = parseInt(process.env.SITEVISIT_RECONFIRM_AFTER_WELCOME_SEC || "60", 10);
        const RECONFIRM_EXISTING_DELAY_SEC = parseInt(process.env.SITEVISIT_RECONFIRM_EXISTING_DELAY_SEC || "60", 10);

        const now = new Date();
        const welcomeDueAt = new Date(now.getTime() + WELCOME_DELAY_SEC * 1000);
        const reconDueAt = new Date(
            now.getTime() +
            (isNewLead
                ? (WELCOME_DELAY_SEC + RECONFIRM_AFTER_WELCOME_SEC)
                : RECONFIRM_EXISTING_DELAY_SEC) *
            1000
        );

        // We always send WhatsApp (you removed the opt-in)
        const whatsAppOptIn = true;

        // ---- Create SiteVisit
        const visit = await SiteVisit.create({
            userId: user._id,
            siteKey: effectiveSiteKey || undefined,
            when,
            address: address || formattedAddress || "",
            coords: coords || undefined,
            notes: notes || "",
            status: "requested",
            needsTriage: true,
            triageStatus: "pending",
            leadType: isNewLead ? "new" : "existing",
            bookingMeta: {
                name,
                mobile,
                email: email || "",
                city: city || "",
                budget: budget || "",
                preferredSlot: preferredSlot || "",
                source: "website",
                whatsAppOptIn,
            },
            notify: {
                ...(isNewLead ? { welcomeDueAt } : {}),
                reconDueAt,
            },
        });

        visit.bookingRef = toBookingRef(visit._id);
        await visit.save();

        return res.json({
            success: true,
            bookingRef: visit.bookingRef,
            visitId: visit._id,
            status: visit.status,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err?.message || "Server error" });
    }
}
