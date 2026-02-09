// server/services/assignmentService.js
import SiteVisit from "../models/SiteVisit.js";
import VendorUsers from "../models/VendorUsers.js";
import { markSiteVisitProgress } from "../utils/steps.js";
import fetch from "node-fetch";
import { sendmail } from "../utils/sendmail.js";

// Helper: env or default timing
const toInt = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const IS_TEST = String(process.env.ASSIGN_TEST_MODE || "").toLowerCase() === "true";

// Threshold style:
//  - TEST: 1 minute
//  - PROD: 120 minutes (2 hours)  (you can set ASSIGN_DELAY_THRESHOLD_MIN=2/3 for 2-3 minutes)
const DELAY_THRESHOLD_MINUTES = IS_TEST
    ? toInt(process.env.ASSIGN_DELAY_THRESHOLD_MIN, 1)
    : toInt(process.env.ASSIGN_DELAY_THRESHOLD_MIN, 120);

const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "+91XXXXXXXXXX";

// Interakt template names (set these in env)
const WA_TPL_CLIENT_ASSIGNED = process.env.INTERAKT_TEMPLATE_CLIENT_ENGINEER_ASSIGNED || "tn_client_engineer_assigned_v1";
const WA_TPL_VENDOR_ASSIGNED = process.env.INTERAKT_TEMPLATE_VENDOR_NEW_ASSIGNMENT || "tn_vendor_new_assignment_v1";

function toBookingRef(id) {
    return String(id).slice(-6).toUpperCase();
}

function normalizeMobile(m) {
    return String(m || "").replace(/\D/g, "").slice(-10);
}

function safeStr(v) {
    return String(v ?? "").trim();
}

function formatWhenIST(d) {
    if (!d) return "";
    try {
        return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(d));
    } catch {
        return new Date(d).toLocaleString();
    }
}

function mapLink(coords) {
    const lat = coords?.lat;
    const lng = coords?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return "";
    return `https://maps.google.com/?q=${lat},${lng}`;
}

/* ---------------------- WHATSAPP (INTERAKT) ---------------------- */
async function sendInteraktTemplate({
    phone10,
    countryCode = "+91",
    templateName,
    languageCode = "en",
    bodyValues,
    callbackData,
}) {
    const apiKey = process.env.INTERAKT_API_KEY;
    if (!apiKey) throw new Error("INTERAKT_API_KEY missing");

    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
            Authorization: `Basic ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            countryCode,
            phoneNumber: phone10, // 10 digits only
            callbackData: callbackData || "",
            type: "Template",
            template: {
                name: templateName,
                languageCode,
                bodyValues,
            },
        }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.result === false) {
        throw new Error(json?.message || `Interakt failed (${res.status})`);
    }

    return json;
}

/* ---------------------- EMAIL HTML HELPERS ---------------------- */

function escapeHtml(s) {
    return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clientAssignedEmailHtml({
    clientName,
    bookingRef,
    preferredSlot,
    address,
    vendorName,
    vendorPhone,
}) {
    return `
  <div style="background:#f7f7f8;padding:24px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid rgba(17,17,17,0.08);border-radius:16px;overflow:hidden;">
      <div style="padding:18px 20px;background:#151515;color:#fff;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">Site Visit Update</div>
        <div style="margin-top:6px;font-size:18px;font-weight:800;">Engineer assigned to your request</div>
      </div>

      <div style="padding:18px 20px;color:#111;">
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">
          Hi <b>${escapeHtml(clientName)}</b>, your site visit request has been assigned to a field executive.
          They will contact you shortly to confirm the final schedule.
        </p>

        <div style="margin:14px 0;padding:14px;border:1px solid rgba(17,17,17,.10);border-radius:12px;background:#fafafa;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px;line-height:1.5;">
            <div style="min-width:200px;">
              <div style="color:rgba(17,17,17,.60);font-weight:700;">Booking Ref</div>
              <div style="font-weight:900;">${escapeHtml(bookingRef)}</div>
            </div>
            <div style="min-width:200px;">
              <div style="color:rgba(17,17,17,.60);font-weight:700;">Preferred Slot</div>
              <div style="font-weight:800;">${escapeHtml(preferredSlot)}</div>
            </div>
          </div>

          <div style="margin-top:12px;">
            <div style="color:rgba(17,17,17,.60);font-weight:700;font-size:13px;">Plot Location</div>
            <div style="font-weight:650;font-size:13px;line-height:1.5;">${escapeHtml(address)}</div>
          </div>

          <div style="margin-top:12px;">
            <div style="color:rgba(17,17,17,.60);font-weight:700;font-size:13px;">Assigned Field Executive</div>
            <div style="font-weight:750;font-size:13px;line-height:1.5;">
              ${escapeHtml(vendorName)} • ${escapeHtml(vendorPhone)}
            </div>
          </div>
        </div>

        <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(17,17,17,.72);">
          Need help? Call/WhatsApp us at <b>${escapeHtml(SUPPORT_PHONE)}</b>.
        </p>
      </div>

      <div style="padding:14px 20px;border-top:1px solid rgba(17,17,17,0.08);font-size:12px;color:rgba(17,17,17,0.58);">
        TowardsNorth • Construction
      </div>
    </div>
  </div>`;
}

function vendorAssignedEmailHtml({
    vendorName,
    bookingRef,
    clientName,
    clientPhone,
    preferredSlot,
    address,
    mapUrl,
}) {
    return `
  <div style="background:#f7f7f8;padding:24px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid rgba(17,17,17,0.08);border-radius:16px;overflow:hidden;">
      <div style="padding:18px 20px;background:#151515;color:#fff;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">New Assignment</div>
        <div style="margin-top:6px;font-size:18px;font-weight:800;">Site visit assigned</div>
      </div>

      <div style="padding:18px 20px;color:#111;">
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">
          Hi <b>${escapeHtml(vendorName)}</b>, a new site visit has been assigned to you. Please contact the client to confirm.
        </p>

        <div style="margin:14px 0;padding:14px;border:1px solid rgba(17,17,17,.10);border-radius:12px;background:#fafafa;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px;line-height:1.5;">
            <div style="min-width:200px;">
              <div style="color:rgba(17,17,17,.60);font-weight:700;">Booking Ref</div>
              <div style="font-weight:900;">${escapeHtml(bookingRef)}</div>
            </div>
            <div style="min-width:200px;">
              <div style="color:rgba(17,17,17,.60);font-weight:700;">Preferred Slot</div>
              <div style="font-weight:800;">${escapeHtml(preferredSlot)}</div>
            </div>
          </div>

          <div style="margin-top:12px;">
            <div style="color:rgba(17,17,17,.60);font-weight:700;font-size:13px;">Client</div>
            <div style="font-weight:750;font-size:13px;line-height:1.5;">
              ${escapeHtml(clientName)} • ${escapeHtml(clientPhone)}
            </div>
          </div>

          <div style="margin-top:12px;">
            <div style="color:rgba(17,17,17,.60);font-weight:700;font-size:13px;">Location</div>
            <div style="font-weight:650;font-size:13px;line-height:1.5;">${escapeHtml(address)}</div>
            ${mapUrl ? `<div style="margin-top:10px;"><a href="${mapUrl}" style="color:#111;text-decoration:underline;">Open in Google Maps</a></div>` : ""}
          </div>
        </div>

        <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(17,17,17,.72);">
          Support: <b>${escapeHtml(SUPPORT_PHONE)}</b>
        </p>
      </div>

      <div style="padding:14px 20px;border-top:1px solid rgba(17,17,17,0.08);font-size:12px;color:rgba(17,17,17,0.58);">
        TowardsNorth • Field Operations
      </div>
    </div>
  </div>`;
}

/* ---------------------- VENDOR PICKER ---------------------- */

async function pickNextVendor() {
    const vendor = await VendorUsers.findOne({
        isActive: true,
        department: "Field Operations",
        role: "Field Executive",
        // ✅ recommended: enforce dailyLimit
        $expr: { $lt: ["$assignedToday", "$dailyLimit"] },
    })
        .sort({ lastAssignedAt: 1, _id: 1 })
        .lean({ getters: true });

    return vendor || null;
}

/* ---------------------- NOTIFICATIONS AFTER ASSIGN ---------------------- */

async function notifyAfterAssign({ visit, vendor }) {
    // client details
    const clientName = safeStr(visit?.bookingMeta?.name) || "Customer";
    const clientPhone10 = normalizeMobile(visit?.bookingMeta?.mobile);
    const clientEmail = safeStr(visit?.bookingMeta?.email);

    // vendor details
    const vendorName = safeStr(vendor?.username || vendor?.name || "Field Executive");
    const vendorPhone10 = normalizeMobile(vendor?.mobile || vendor?.phone);
    const vendorEmail = safeStr(vendor?.email);

    const bookingRef = safeStr(visit?.bookingRef) || toBookingRef(visit?._id);
    const preferredSlot = safeStr(visit?.bookingMeta?.preferredSlot) || formatWhenIST(visit?.when) || "—";
    const address = safeStr(visit?.address) || "Pinned location";
    const mapsUrl = mapLink(visit?.coords);

    // ---- WhatsApp to client
    if (clientPhone10 && clientPhone10.length === 10) {
        try {
            await sendInteraktTemplate({
                phone10: clientPhone10,
                countryCode: "+91",
                templateName: WA_TPL_CLIENT_ASSIGNED,
                languageCode: "en",
                bodyValues: [
                    clientName,
                    bookingRef,
                    vendorName,
                    vendorPhone10 || SUPPORT_PHONE,
                    preferredSlot,
                    SUPPORT_PHONE,
                ],
                callbackData: `site_visit_assigned:${String(visit._id)}:${bookingRef}`,
            });
        } catch (e) {
            console.error("[notifyAfterAssign] WhatsApp client failed:", e?.message || e);
        }
    }

    // ---- WhatsApp to vendor
    if (vendorPhone10 && vendorPhone10.length === 10) {
        try {
            await sendInteraktTemplate({
                phone10: vendorPhone10,
                countryCode: "+91",
                templateName: WA_TPL_VENDOR_ASSIGNED,
                languageCode: "en",
                bodyValues: [
                    vendorName,
                    bookingRef,
                    clientName,
                    clientPhone10 || "",
                    preferredSlot,
                    address,
                    mapsUrl || "Maps link available in dashboard",
                    SUPPORT_PHONE,
                ],
                callbackData: `vendor_assignment:${String(visit._id)}:${bookingRef}:${String(vendor._id)}`,
            });
        } catch (e) {
            console.error("[notifyAfterAssign] WhatsApp vendor failed:", e?.message || e);
        }
    }

    // ---- Email to client
    if (clientEmail) {
        try {
            await sendmail({
                to: clientEmail,
                subject: `Engineer Assigned — Booking Ref ${bookingRef}`,
                html: clientAssignedEmailHtml({
                    clientName,
                    bookingRef,
                    preferredSlot,
                    address,
                    vendorName,
                    vendorPhone: vendorPhone10 || SUPPORT_PHONE,
                }),
            });
        } catch (e) {
            console.error("[notifyAfterAssign] Email client failed:", e?.message || e);
        }
    }

    // ---- Email to vendor
    if (vendorEmail) {
        try {
            await sendmail({
                to: vendorEmail,
                subject: `New Site Visit Assigned — Ref ${bookingRef}`,
                html: vendorAssignedEmailHtml({
                    vendorName,
                    bookingRef,
                    clientName,
                    clientPhone: clientPhone10 || "",
                    preferredSlot,
                    address,
                    mapUrl: mapsUrl,
                }),
            });
        } catch (e) {
            console.error("[notifyAfterAssign] Email vendor failed:", e?.message || e);
        }
    }
}

/**
 * Assign one visit to a vendor (by vendorId), update visit status→confirmed,
 * bump vendor counters, then notify both parties.
 */
async function assignVisitToVendor(visitId, vendorId) {
    const visit = await SiteVisit.findById(visitId);
    if (!visit) return null;
    if (visit.assignedTo) return visit; // idempotent

    visit.assignedTo = vendorId;

    // status normalization
    if (visit.status === "scheduled" || visit.status === "requested" || visit.status === "upcoming") {
        visit.status = "confirmed";
    }

    // ensure bookingRef exists (for messaging)
    if (!visit.bookingRef) visit.bookingRef = toBookingRef(visit._id);

    await visit.save();

    await VendorUsers.findByIdAndUpdate(vendorId, {
        $set: { lastAssignedAt: new Date() },
        $inc: { assignedToday: 1 },
    });

    // mirror progress step
    try {
        await markSiteVisitProgress(visit.userId, "engineer_assigned");
    } catch (e) {
        console.error("[assignVisitToVendor] markSiteVisitProgress error:", e?.message);
    }

    // notify (non-blocking)
    try {
        const vendor = await VendorUsers.findById(vendorId).lean({ getters: true });
        if (vendor) await notifyAfterAssign({ visit, vendor });
    } catch (e) {
        console.error("[assignVisitToVendor] notifyAfterAssign error:", e?.message || e);
    }

    return visit;
}

/**
 * Assign visits AFTER a delay from creation time.
 */
export async function assignReadyByCreationDelay() {
    const now = new Date();
    const threshold = new Date(now.getTime() - DELAY_THRESHOLD_MINUTES * 60 * 1000);

    const pending = await SiteVisit.find({
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
        status: { $in: ["scheduled", "requested", "upcoming"] },
        triageStatus: "approved",
        createdAt: { $lte: threshold },
    })
        .sort({ createdAt: 1, when: 1 })
        .limit(30)
        .lean({ getters: true });

    let assigned = 0;

    for (const sv of pending) {
        const vendor = await pickNextVendor();
        if (!vendor) break;

        const done = await assignVisitToVendor(sv._id, vendor._id);
        if (done) assigned += 1;
    }

    return assigned;
}

export async function resetVendorDailyCounters() {
    await VendorUsers.updateMany({}, { $set: { assignedToday: 0 } });
}
