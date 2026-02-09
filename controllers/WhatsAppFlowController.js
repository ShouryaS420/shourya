import SiteVisit from "../models/SiteVisit.js";

function safeString(v) {
    return String(v ?? "").trim();
}

function normalizeDecision(raw) {
    const s = safeString(raw).toLowerCase();
    if (!s) return "";
    if (["yes", "y", "1", "confirm", "confirmed", "true"].includes(s)) return "yes";
    if (["no", "n", "0", "reject", "rejected", "false"].includes(s)) return "no";
    return "";
}

// Flexible extractor: supports {bookingRef, decision}, or nested provider payloads
function extractBookingRefAndDecision(payload) {
    const bookingRef =
        safeString(payload?.bookingRef) ||
        safeString(payload?.data?.bookingRef) ||
        safeString(payload?.response?.bookingRef) ||
        safeString(payload?.context?.bookingRef);

    const decisionRaw =
        payload?.decision ??
        payload?.data?.decision ??
        payload?.response?.decision ??
        payload?.answer ??
        payload?.data?.answer ??
        payload?.response?.answer ??
        payload?.confirm;

    const decision = normalizeDecision(decisionRaw);
    return { bookingRef, decision };
}

export async function captureSiteVisitReconfirmDecision(req, res) {
    try {
        // Optional security
        const expected = process.env.WHATSAPP_FLOW_WEBHOOK_SECRET;
        if (expected) {
            const got = safeString(req.headers["x-tn-secret"] || req.query?.k);
            if (!got || got !== expected) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
        }

        const payload = req.body || {};
        const { bookingRef, decision } = extractBookingRefAndDecision(payload);

        if (!bookingRef) {
            return res.status(400).json({ success: false, message: "bookingRef is required" });
        }
        if (!decision) {
            return res.status(400).json({ success: false, message: "decision must be yes/no" });
        }

        const visit = await SiteVisit.findOne({ bookingRef }).select("_id bookingRef notify status triageStatus").lean();
        if (!visit) {
            return res.status(404).json({ success: false, message: "SiteVisit not found" });
        }

        await SiteVisit.updateOne(
            { _id: visit._id },
            {
                $set: {
                    "notify.reconResponse": decision,
                    "notify.reconResponseAt": new Date(),
                    "notify.reconResponseRaw": payload,
                },
            }
        );

        return res.json({ success: true, bookingRef, decision });
    } catch (err) {
        return res.status(500).json({ success: false, message: err?.message || "Server error" });
    }
}
