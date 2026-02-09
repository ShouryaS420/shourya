import SiteVisit from "../models/SiteVisit.js";
import { sendInteraktTemplate } from "./interaktService.js";

function normalizeMobile10(m) {
    return String(m || "").replace(/\D/g, "").slice(-10);
}

function backoffNextDue(attempts) {
    const mins = Math.min(15, Math.max(1, Math.pow(2, Math.max(0, attempts - 1))));
    return new Date(Date.now() + mins * 60 * 1000);
}

function formatWhenIST(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(+dt)) return "";

    const datePart = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        month: "short",
        day: "2-digit",
        timeZone: "Asia/Kolkata",
    }).format(dt);

    const timePart = new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    }).format(dt);

    return `${datePart} • ${timePart}`;
}

function log(...args) {
    console.log("[SV-NOTIFY]", ...args);
}

function env(name, fallback) {
    return process.env[name] || fallback;
}

const ACTIVE_STATUSES = ["requested", "scheduled", "upcoming", "confirmed"];
const FLOW_ACTIVE = new Set([
    "awaiting_confirm",
    "paused",
    "awaiting_reschedule",
    "awaiting_readiness",
    "awaiting_custom_time",
    "awaiting_budget",
    "awaiting_timeline",
    "awaiting_decision",
    "awaiting_summary",
]);

/**
 * Reminder policy (recommended defaults)
 * - confirm: 6h then 24h (max 2)
 * - others: 24h then 48h (max 2)
 */
function reminderPolicy(step) {
    if (step === "awaiting_confirm") return { delaysMs: [6 * 3600e3, 24 * 3600e3], max: 2 };
    return { delaysMs: [24 * 3600e3, 48 * 3600e3], max: 2 };
}

/**
 * Expiry policy: 7 days inactivity
 */
const EXPIRY_MS = 7 * 24 * 3600e3;

/**
 * Send helper: records last outbound + stepSentAt marker
 */
async function sendTplAndMark({
    visitId,
    phone10,
    templateName,
    languageCode,
    countryCode,
    bodyValues,
    callbackData,
    stepSentKey, // e.g. "confirm", "budget", ...
}) {
    const r = await sendInteraktTemplate({
        phone10,
        templateName,
        languageCode,
        countryCode,
        bodyValues,
        callbackData,
    });

    const set = {
        "notify.lastOutboundAt": new Date(),
        "notify.lastOutboundTemplate": templateName,
    };
    if (stepSentKey) {
        set[`notify.stepSentAt.${stepSentKey}`] = new Date();
    }

    await SiteVisit.updateOne({ _id: visitId }, { $set: set });

    return r;
}

/**
 * ============================
 * (A) INITIAL NOTIFICATIONS: Welcome + Confirm
 * ============================
 */
export async function processSiteVisitNotifications() {
    const now = new Date();
    const staleLockCutoff = new Date(now.getTime() - 5 * 60 * 1000);

    const welcomeTemplate = env("INTERAKT_TEMPLATE_WELCOME", "tn_sitevisit_welcome_v1");
    const confirmTemplate = env("INTERAKT_TEMPLATE_CONFIRM", "tn_sitevisit_confirm_v1");

    const lang = env("INTERAKT_TEMPLATE_LANG", "en");
    const countryCode = env("INTERAKT_COUNTRY_CODE", "+91");

    let welcomeSent = 0,
        reconSent = 0,
        welcomeFailed = 0,
        reconFailed = 0;

    // unlock stale locks
    const unlockedWelcome = await SiteVisit.updateMany(
        { "notify.welcomeClaimedAt": { $lte: staleLockCutoff }, "notify.welcomeSentAt": { $exists: false } },
        { $unset: { "notify.welcomeClaimedAt": "" } }
    );

    const unlockedRecon = await SiteVisit.updateMany(
        { "notify.reconClaimedAt": { $lte: staleLockCutoff }, "notify.reconSentAt": { $exists: false } },
        { $unset: { "notify.reconClaimedAt": "" } }
    );

    if (unlockedWelcome.modifiedCount || unlockedRecon.modifiedCount) {
        log("Unlocked stale locks:", { welcome: unlockedWelcome.modifiedCount, recon: unlockedRecon.modifiedCount });
    }

    // 1) Welcome (new leads only)
    const welcomeDue = await SiteVisit.find({
        status: { $in: ACTIVE_STATUSES },
        leadType: "new",
        "notify.welcomeDueAt": { $exists: true, $lte: now },
        "notify.welcomeSentAt": { $exists: false },
        $or: [{ "notify.welcomeClaimedAt": { $exists: false } }, { "notify.welcomeClaimedAt": { $lte: staleLockCutoff } }],
    })
        .sort({ createdAt: 1 })
        .limit(30)
        .lean();

    if (welcomeDue.length) log("Welcome due:", welcomeDue.length);

    for (const sv of welcomeDue) {
        const locked = await SiteVisit.findOneAndUpdate(
            {
                _id: sv._id,
                "notify.welcomeSentAt": { $exists: false },
                $or: [{ "notify.welcomeClaimedAt": { $exists: false } }, { "notify.welcomeClaimedAt": { $lte: staleLockCutoff } }],
            },
            { $set: { "notify.welcomeClaimedAt": now }, $inc: { "notify.welcomeAttempts": 1 } },
            { new: true }
        ).lean();

        if (!locked) continue;

        const name = locked.bookingMeta?.name || "there";
        const phone10 = normalizeMobile10(locked.bookingMeta?.mobile);

        try {
            const r = await sendTplAndMark({
                visitId: locked._id,
                phone10,
                templateName: welcomeTemplate,
                languageCode: lang,
                countryCode,
                bodyValues: [name],
                callbackData: `welcome:${String(locked._id)}`,
                stepSentKey: null,
            });

            await SiteVisit.updateOne(
                { _id: locked._id },
                {
                    $set: {
                        "notify.welcomeSentAt": new Date(),
                        "notify.welcomeLastError": "",
                    },
                    $unset: { "notify.welcomeClaimedAt": "" },
                }
            );

            welcomeSent += 1;
            log("Welcome sent", { visitId: String(locked._id), phone10, interaktId: r?.id });
        } catch (e) {
            welcomeFailed += 1;
            const attempts = (locked.notify?.welcomeAttempts || 1) + 1;

            await SiteVisit.updateOne(
                { _id: locked._id },
                {
                    $set: {
                        "notify.welcomeLastError": String(e?.message || e),
                        "notify.welcomeDueAt": backoffNextDue(attempts),
                    },
                    $unset: { "notify.welcomeClaimedAt": "" },
                }
            );

            log("Welcome FAILED", { visitId: String(locked._id), phone10, err: String(e?.message || e) });
        }
    }

    // 2) Confirm message (all leads)
    const reconDue = await SiteVisit.find({
        status: { $in: ACTIVE_STATUSES },
        "notify.reconDueAt": { $exists: true, $lte: now },
        "notify.reconSentAt": { $exists: false },
        "notify.reconChoice": { $in: ["", null] },
        $or: [{ "notify.reconClaimedAt": { $exists: false } }, { "notify.reconClaimedAt": { $lte: staleLockCutoff } }],
    })
        .sort({ createdAt: 1 })
        .limit(30)
        .lean();

    if (reconDue.length) log("Confirm due:", reconDue.length);

    for (const sv of reconDue) {
        const locked = await SiteVisit.findOneAndUpdate(
            {
                _id: sv._id,
                "notify.reconSentAt": { $exists: false },
                $or: [{ "notify.reconClaimedAt": { $exists: false } }, { "notify.reconClaimedAt": { $lte: staleLockCutoff } }],
            },
            { $set: { "notify.reconClaimedAt": now }, $inc: { "notify.reconAttempts": 1 } },
            { new: true }
        ).lean();

        if (!locked) continue;

        const name = locked.bookingMeta?.name || "there";
        const bookingRef = locked.bookingRef || String(locked._id).slice(-6).toUpperCase();
        const phone10 = normalizeMobile10(locked.bookingMeta?.mobile);

        const address = locked.address || locked.bookingMeta?.formattedAddress || locked.bookingMeta?.address || "";
        const preferredSlot = locked.bookingMeta?.preferredSlot || "";
        const slotText = preferredSlot || formatWhenIST(locked.when);

        try {
            const r = await sendTplAndMark({
                visitId: locked._id,
                phone10,
                templateName: confirmTemplate,
                languageCode: lang,
                countryCode,
                bodyValues: [name, bookingRef, address, slotText],
                callbackData: `sv_recon:${String(locked._id)}:${bookingRef}`,
                stepSentKey: "confirm",
            });

            await SiteVisit.updateOne(
                { _id: locked._id },
                {
                    $set: {
                        "notify.reconSentAt": new Date(),
                        "notify.reconLastError": "",
                        "notify.flowStep": "awaiting_confirm",
                        "notify.flowStepSetAt": new Date(),
                    },
                    $unset: { "notify.reconClaimedAt": "" },
                }
            );

            reconSent += 1;
            log("Confirm sent", { visitId: String(locked._id), phone10, interaktId: r?.id });
        } catch (e) {
            reconFailed += 1;
            const attempts = (locked.notify?.reconAttempts || 1) + 1;

            await SiteVisit.updateOne(
                { _id: locked._id },
                {
                    $set: {
                        "notify.reconLastError": String(e?.message || e),
                        "notify.reconDueAt": backoffNextDue(attempts),
                    },
                    $unset: { "notify.reconClaimedAt": "" },
                }
            );

            log("Confirm FAILED", { visitId: String(locked._id), phone10, err: String(e?.message || e) });
        }
    }

    if (welcomeSent || reconSent || welcomeFailed || reconFailed) {
        log("Summary", { welcomeSent, reconSent, welcomeFailed, reconFailed });
    }

    return { welcomeSent, reconSent, welcomeFailed, reconFailed };
}

/**
 * ============================
 * (B) STEP REMINDERS
 * ============================
 * Sends a controlled reminder for current flow step if user is inactive.
 */
export async function processSiteVisitStepReminders() {
    const now = new Date();

    // Only those in an active step, not expired, not completed
    const due = await SiteVisit.find({
        status: { $in: ACTIVE_STATUSES },
        "notify.flowStep": { $in: Array.from(FLOW_ACTIVE) },
        "notify.expiredAt": { $exists: false },
    })
        .sort({ "notify.flowStepSetAt": 1 })
        .limit(50);

    let sent = 0;
    let skipped = 0;

    const lang = env("INTERAKT_TEMPLATE_LANG", "en");
    const countryCode = env("INTERAKT_COUNTRY_CODE", "+91");

    for (const visit of due) {
        const step = visit.notify?.flowStep || "";
        const stepSetAt = visit.notify?.flowStepSetAt || visit.notify?.reconSentAt || visit.createdAt;
        const inactivityMs = now.getTime() - new Date(stepSetAt).getTime();

        const { delaysMs, max } = reminderPolicy(step);

        // Determine reminder index to send
        const reminderKey =
            step === "awaiting_confirm" ? "confirm" :
                step === "paused" ? "paused" :
                    step === "awaiting_reschedule" ? "reschedule" :
                        step === "awaiting_readiness" ? "readiness" :
                            step === "awaiting_custom_time" ? "custom_time" :
                                step === "awaiting_budget" ? "budget" :
                                    step === "awaiting_timeline" ? "timeline" :
                                        step === "awaiting_decision" ? "decision" :
                                            step === "awaiting_summary" ? "summary" : "";

        if (!reminderKey) { skipped += 1; continue; }

        const rem = visit.notify?.stepReminders?.[reminderKey] || { count: 0, lastAt: null };
        if ((rem.count || 0) >= max) { skipped += 1; continue; }

        // we only send reminder if inactivity passed next threshold
        const nextThreshold = delaysMs[rem.count || 0] ?? null;
        if (!nextThreshold) { skipped += 1; continue; }
        if (inactivityMs < nextThreshold) { skipped += 1; continue; }

        const phone10 = normalizeMobile10(visit.bookingMeta?.mobile);
        if (!phone10 || phone10.length !== 10) { skipped += 1; continue; }

        const name = visit.bookingMeta?.name || "there";
        const bookingRef = visit.bookingRef || String(visit._id).slice(-6).toUpperCase();

        // Re-send the current step template (simple and reliable)
        // You can later create dedicated reminder templates if you want.
        let templateName = "";
        let bodyValues = [];
        let callbackData = "";

        if (step === "awaiting_confirm") {
            templateName = env("INTERAKT_TEMPLATE_CONFIRM", "tn_sitevisit_confirm_v1");
            const address = visit.address || visit.bookingMeta?.formattedAddress || visit.bookingMeta?.address || "";
            const preferredSlot = visit.bookingMeta?.preferredSlot || "";
            const slotText = preferredSlot || formatWhenIST(visit.when);
            bodyValues = [name, bookingRef, address, slotText];
            callbackData = `sv_recon_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "paused") {
            templateName = env("INTERAKT_TEMPLATE_NUDGE", "tn_sitevisit_nudge_v1");
            bodyValues = [name, bookingRef];
            callbackData = `sv_nudge_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_reschedule") {
            templateName = env("INTERAKT_TEMPLATE_RESCHEDULE", "tn_sitevisit_reschedule_v1");
            bodyValues = [name, bookingRef];
            callbackData = `sv_reschedule_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_readiness") {
            templateName = env("INTERAKT_TEMPLATE_READINESS", "tn_sitevisit_call_slots_v1");
            bodyValues = [name];
            callbackData = `sv_readiness_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_custom_time") {
            templateName = env("INTERAKT_TEMPLATE_CUSTOM_TIME", "tn_sitevisit_custom_time_v1");
            bodyValues = [name, bookingRef];
            callbackData = `sv_customtime_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_budget") {
            templateName = env("INTERAKT_TEMPLATE_BUDGET", "tn_sitevisit_budget_v1");
            bodyValues = [name, bookingRef];
            callbackData = `sv_budget_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_timeline") {
            templateName = env("INTERAKT_TEMPLATE_TIMELINE", "tn_sitevisit_timeline_v1");
            bodyValues = [name, bookingRef];
            callbackData = `sv_timeline_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_decision") {
            templateName = env("INTERAKT_TEMPLATE_DECISION", "tn_sitevisit_decision_v1");
            bodyValues = [name, bookingRef];
            callbackData = `sv_decision_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        } else if (step === "awaiting_summary") {
            templateName = env("INTERAKT_TEMPLATE_SUMMARY", "tn_sitevisit_summary_proceed_v1");

            const callPref =
                visit.notify.customCallWindowLabel ||
                visit.notify.readinessWindowLabel ||
                "Not selected";

            const budget = visit.notify.budgetRange || "Not selected";
            const timeline = visit.notify.timeline || "Not selected";
            const decision = visit.notify.decisionAuthority || "Not selected";

            bodyValues = [name, bookingRef, callPref, budget, timeline, decision];
            callbackData = `sv_summary_reminder:${String(visit._id)}:${bookingRef}:r${(rem.count || 0) + 1}`;
        }

        if (!templateName) { skipped += 1; continue; }

        try {
            await sendTplAndMark({
                visitId: visit._id,
                phone10,
                templateName,
                languageCode: lang,
                countryCode,
                bodyValues,
                callbackData,
                stepSentKey: null,
            });

            await SiteVisit.updateOne(
                { _id: visit._id },
                {
                    $set: {
                        [`notify.stepReminders.${reminderKey}.count`]: (rem.count || 0) + 1,
                        [`notify.stepReminders.${reminderKey}.lastAt`]: new Date(),
                    },
                }
            );

            sent += 1;
            log("Reminder sent", { visitId: String(visit._id), step, reminder: (rem.count || 0) + 1 });
        } catch (e) {
            skipped += 1;
            log("Reminder FAILED", { visitId: String(visit._id), step, err: String(e?.message || e) });
        }
    }

    return { sent, skipped };
}

/**
 * ============================
 * (C) RECOVERY SENDER
 * ============================
 * If flowStep says awaiting_X but the step prompt was never marked as sent,
 * we send it once and mark it. (covers server crash between save + send)
 */
export async function processSiteVisitRecoverySends() {
    const now = new Date();
    const lang = env("INTERAKT_TEMPLATE_LANG", "en");
    const countryCode = env("INTERAKT_COUNTRY_CODE", "+91");

    const candidates = await SiteVisit.find({
        status: { $in: ACTIVE_STATUSES },
        "notify.flowStep": { $in: Array.from(FLOW_ACTIVE) },
        "notify.expiredAt": { $exists: false },
    }).limit(50);

    let sent = 0;
    let fixed = 0;

    for (const visit of candidates) {
        const step = visit.notify?.flowStep || "";
        const phone10 = normalizeMobile10(visit.bookingMeta?.mobile);
        if (!phone10 || phone10.length !== 10) continue;

        const name = visit.bookingMeta?.name || "there";
        const bookingRef = visit.bookingRef || String(visit._id).slice(-6).toUpperCase();

        // Check stepSentAt marker
        let needSend = false;
        let templateName = "";
        let bodyValues = [];
        let callbackData = "";
        let markKey = "";

        if (step === "awaiting_confirm" && !visit.notify?.stepSentAt?.confirm) {
            needSend = true;
            templateName = env("INTERAKT_TEMPLATE_CONFIRM", "tn_sitevisit_confirm_v1");
            const address = visit.address || visit.bookingMeta?.formattedAddress || visit.bookingMeta?.address || "";
            const preferredSlot = visit.bookingMeta?.preferredSlot || "";
            const slotText = preferredSlot || formatWhenIST(visit.when);
            bodyValues = [name, bookingRef, address, slotText];
            callbackData = `sv_recon_recovery:${String(visit._id)}:${bookingRef}`;
            markKey = "confirm";
        }

        // Other steps are typically sent by webhook; recovery will still help if you later mark stepSentAt in webhook.
        if (!needSend) { fixed += 1; continue; }

        // Avoid spamming: if we already sent something recently, skip
        const lastOut = visit.notify?.lastOutboundAt ? new Date(visit.notify.lastOutboundAt) : null;
        if (lastOut && now.getTime() - lastOut.getTime() < 2 * 60 * 1000) {
            fixed += 1;
            continue;
        }

        try {
            await sendTplAndMark({
                visitId: visit._id,
                phone10,
                templateName,
                languageCode: lang,
                countryCode,
                bodyValues,
                callbackData,
                stepSentKey: markKey,
            });
            sent += 1;
            log("Recovery send", { visitId: String(visit._id), step, templateName });
        } catch (e) {
            log("Recovery FAILED", { visitId: String(visit._id), step, err: String(e?.message || e) });
        }
    }

    return { sent, fixed };
}

/**
 * ============================
 * (D) EXPIRY
 * ============================
 * If user goes silent too long, we expire flow and prevent late replies from creating confusion.
 */
export async function processSiteVisitExpiry() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - EXPIRY_MS);

    const q = {
        status: { $in: ACTIVE_STATUSES },
        "notify.flowStep": { $in: Array.from(FLOW_ACTIVE) },
        "notify.expiredAt": { $exists: false },
        $or: [
            { "notify.lastInboundAt": { $exists: false }, createdAt: { $lte: cutoff } },
            { "notify.lastInboundAt": { $lte: cutoff } },
            { "notify.flowStepSetAt": { $lte: cutoff } },
        ],
    };

    const r = await SiteVisit.updateMany(q, {
        $set: {
            "notify.flowStep": "expired",
            "notify.expiredAt": new Date(),
            "notify.expiredReason": "inactivity_7_days",
        },
    });

    return { expired: r.modifiedCount || 0 };
}
