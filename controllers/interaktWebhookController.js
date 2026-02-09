// controllers/interaktWebhookController.js
import crypto from "crypto";
import SiteVisit from "../models/SiteVisit.js";
import { sendInteraktTemplate, normalizeMobile10 } from "../services/interaktService.js";

/**
 * Interakt payloads vary. Button titles may be in:
 * - data.message.button_text (message_api_clicked)
 * - data.message.message (message_received)
 * - data.message.text
 * - data.message.button_reply.title
 * - data.message.interactive.button_reply.title
 * - data.message.interactive.list_reply.title
 */

function timingSafeEqualHex(a, b) {
    const ab = Buffer.from(String(a || ""), "utf8");
    const bb = Buffer.from(String(b || ""), "utf8");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

function verifyInteraktSignature(req) {
    const secret = process.env.INTERAKT_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("⚠️ [INTERAKT] INTERAKT_WEBHOOK_SECRET missing; skipping signature verification");
        return true;
    }

    const headerSigRaw = String(req.headers["interakt-signature"] || "");
    const headerSigHex = headerSigRaw.replace(/^sha256=/i, "").trim();

    const computedHex = crypto
        .createHmac("sha256", secret)
        .update(req.rawBody || Buffer.from(""))
        .digest("hex");

    console.log("🔐 [INTERAKT SIGNATURE CHECK]", {
        receivedRaw: headerSigRaw,
        receivedHex: headerSigHex,
        computedHex,
        rawBodyLength: req.rawBody?.length,
    });

    return timingSafeEqualHex(headerSigHex, computedHex);
}

function getEventType(payload) {
    return String(payload?.type || "");
}

function getPhone10(payload) {
    const p1 = payload?.data?.customer?.phone_number;
    const p2 = payload?.data?.customer?.channel_phone_number;
    return normalizeMobile10(p1 || p2 || "");
}

function pickText(payload) {
    const type = String(payload?.type || "");
    const msg = payload?.data?.message || {};

    // ✅ Best for quick reply click events
    if (type === "message_api_clicked") {
        const bt = msg?.button_text;
        if (typeof bt === "string" && bt.trim()) return bt.trim();
    }

    // ✅ Real user typed messages
    if (type === "message_received") {
        const t = msg?.message;
        if (typeof t === "string" && t.trim()) return t.trim();
    }

    // Fallbacks
    const candidates = [
        msg?.text,
        msg?.button_reply?.title,
        msg?.interactive?.button_reply?.title,
        msg?.interactive?.list_reply?.title,
        payload?.data?.event?.text,
    ];

    const t = candidates.find((x) => typeof x === "string" && x.trim().length);
    return String(t || "").trim();
}

function pickInboundMessageId(payload) {
    return (
        payload?.data?.message?.id ||
        payload?.data?.event?.id ||
        payload?.data?.message_id ||
        ""
    );
}

/**
 * Canonicalize text so minor typography differences do not break routing.
 */
function canon(s) {
    return String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, " ");
}

function env(name, fallback) {
    return process.env[name] || fallback;
}

async function findActiveVisitByPhone(phone10) {
    if (!phone10) return null;
    const re = new RegExp(`${phone10}$`);

    return SiteVisit.findOne({
        $or: [{ "bookingMeta.mobile": re }, { "bookingMeta.mobile": phone10 }],
        status: { $in: ["requested", "scheduled", "upcoming", "confirmed", "in_progress"] },
    }).sort({ createdAt: -1 });
}

/**
 * ✅ Send template + update outbound audit fields.
 * Also updates stepSentAt.<key> for reliability with reminders/recovery.
 */
async function sendTpl({ visit, phone10, templateName, bodyValues, callbackData, stepSentKey }) {
    const languageCode = env("INTERAKT_TEMPLATE_LANG", "en");
    const countryCode = env("INTERAKT_COUNTRY_CODE", "+91");

    console.log("📤 [INTERAKT SEND]", {
        visitId: String(visit._id),
        step: visit.notify?.flowStep,
        templateName,
        phone10,
        bodyValues,
        callbackData,
        stepSentKey,
    });

    const r = await sendInteraktTemplate({
        phone10,
        templateName,
        languageCode,
        countryCode,
        bodyValues,
        callbackData,
    });

    // Persist outbound audit
    visit.notify.lastOutboundAt = new Date();
    visit.notify.lastOutboundTemplate = templateName;
    if (stepSentKey) {
        if (!visit.notify.stepSentAt) visit.notify.stepSentAt = {};
        visit.notify.stepSentAt[stepSentKey] = new Date();
    }
    await visit.save();

    console.log("✅ [INTERAKT SEND OK]", {
        visitId: String(visit._id),
        templateName,
        interaktId: r?.id,
    });

    return r;
}

function logUnmapped({ visit, textRaw, reason }) {
    console.warn("⚠️ [FLOW UNMAPPED]", {
        visitId: String(visit._id),
        flowStep: visit.notify?.flowStep,
        inboundText: textRaw,
        inboundCanon: canon(textRaw),
        reason,
    });
}

function inboundFingerprint({ visitId, step, type, textCanon, msgId }) {
    return crypto
        .createHash("sha256")
        .update([visitId, step, type, textCanon, msgId || ""].join("|"))
        .digest("hex");
}

/**
 * ✅ Step answered guard:
 * If a user clicks another button on the same old message, ignore it safely.
 */
function alreadyAnswered(visit, step) {
    const n = visit?.notify || {};

    if (step === "awaiting_confirm") return Boolean(n.reconChoice);
    if (step === "awaiting_reschedule") return Boolean(n.reschedulePref);
    if (step === "awaiting_readiness") return Boolean(n.readinessWindowKey);
    if (step === "awaiting_custom_time") return Boolean(n.customCallWindowLabel);
    if (step === "awaiting_budget") return Boolean(n.budgetRange);
    if (step === "awaiting_timeline") return Boolean(n.timeline);
    if (step === "awaiting_decision") return Boolean(n.decisionAuthority);
    if (step === "awaiting_summary") return n.flowStep === "completed" || n.flowStep === "canceled";

    return false;
}

function setStep(visit, step) {
    visit.notify.flowStep = step;
    visit.notify.flowStepSetAt = new Date();
}

export async function interaktWebhook(req, res) {
    console.log("📦 [INTERAKT PAYLOAD]", JSON.stringify(req.body, null, 2));

    try {
        if (!verifyInteraktSignature(req)) {
            return res.status(401).json({ ok: false, message: "Invalid signature" });
        }

        const payload = req.body || {};
        const type = getEventType(payload);

        /**
         * ✅ IMPORTANT:
         * - Quick reply button clicks arrive as "message_api_clicked" (your logs show this)
         * - Typed replies arrive as "message_received"
         */
        const ALLOWED_TYPES = new Set(["message_received", "message_api_clicked"]);
        if (!ALLOWED_TYPES.has(type)) {
            return res.status(200).json({ ok: true, ignored: true, reason: `ignored_type:${type}` });
        }

        const textRaw = pickText(payload);
        const textC = canon(textRaw);
        const phone10 = getPhone10(payload);
        const inboundMsgId = pickInboundMessageId(payload);

        console.log("📥 [INTERAKT INBOUND]", {
            ts: new Date().toISOString(),
            type,
            phone10,
            inboundMsgId,
            textRaw,
            textCanon: textC,
        });

        if (!textRaw) return res.status(200).json({ ok: true, ignored: true, reason: "no_text" });

        const visit = await findActiveVisitByPhone(phone10);
        if (!visit) return res.status(200).json({ ok: true, ignored: true, reason: "no_visit_match" });

        // If flow expired, do not continue old state machine
        if (visit.notify?.flowStep === "expired") {
            // You can optionally send a fresh restart template here; for now we just ignore safely
            await visit.save();
            return res.status(200).json({ ok: true, ignored: true, reason: "flow_expired" });
        }

        // Bootstrap step if missing
        if (!visit.notify.flowStep) {
            if (visit.notify.reconSentAt && !visit.notify.reconChoice) {
                setStep(visit, "awaiting_confirm");
            }
        }

        const stepNow = String(visit.notify?.flowStep || "");

        // If this step already answered, do nothing (prevents multi-click chaos)
        if (alreadyAnswered(visit, stepNow)) {
            // still store audit below; do not advance flow
            visit.notify.lastInboundAt = new Date();
            visit.notify.lastInboundText = textRaw;
            visit.notify.lastInboundType = type;
            visit.notify.lastWebhookRaw = payload;
            if (inboundMsgId) visit.notify.lastInboundMessageId = inboundMsgId;
            await visit.save();
            return res.status(200).json({ ok: true, ignored: true, reason: "step_already_answered" });
        }

        // Strong idempotency: dedupe by visit+step+canon(text)+msgId
        const fp = inboundFingerprint({
            visitId: String(visit._id),
            step: stepNow,
            type,
            textCanon: textC,
            msgId: inboundMsgId,
        });

        if (visit.notify.lastInboundFingerprint === fp) {
            return res.status(200).json({ ok: true, ignored: true, reason: "duplicate_fingerprint" });
        }

        if (inboundMsgId && visit.notify.lastInboundMessageId === inboundMsgId) {
            return res.status(200).json({ ok: true, ignored: true, reason: "duplicate_inbound" });
        }

        // audit
        visit.notify.lastInboundAt = new Date();
        visit.notify.lastInboundText = textRaw;
        visit.notify.lastInboundType = type;
        visit.notify.lastWebhookRaw = payload;
        if (inboundMsgId) visit.notify.lastInboundMessageId = inboundMsgId;
        visit.notify.lastInboundFingerprint = fp;
        visit.notify.lastInboundFingerprintAt = new Date();

        const name = visit.bookingMeta?.name || "there";
        const bookingRef = visit.bookingRef || String(visit._id).slice(-6).toUpperCase();

        // =========================
        // STEP 1: Confirm (T2)
        // =========================
        if (visit.notify.flowStep === "awaiting_confirm") {
            if (textC === canon("Yes, confirm")) {
                visit.notify.reconChoice = "yes";
                visit.notify.reconChoiceAt = new Date();
                setStep(visit, "awaiting_readiness");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_READINESS", "tn_sitevisit_call_slots_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name],
                    callbackData: `sv_step:readiness:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "readiness",
                });

                return res.status(200).json({ ok: true, handled: "confirm_yes" });
            }

            if (textC === canon("No, not now")) {
                visit.notify.reconChoice = "no";
                visit.notify.reconChoiceAt = new Date();
                setStep(visit, "paused");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_NUDGE", "tn_sitevisit_nudge_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:nudge:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "nudge",
                });

                return res.status(200).json({ ok: true, handled: "confirm_no" });
            }

            if (textC === canon("Reschedule")) {
                visit.notify.reconChoice = "reschedule";
                visit.notify.reconChoiceAt = new Date();
                setStep(visit, "awaiting_reschedule");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_RESCHEDULE", "tn_sitevisit_reschedule_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:reschedule:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "reschedule",
                });

                return res.status(200).json({ ok: true, handled: "confirm_reschedule" });
            }

            if (textC === canon("Cancel")) {
                visit.notify.reconChoice = "cancel";
                visit.notify.reconChoiceAt = new Date();
                setStep(visit, "canceled");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_CANCELLED", "tn_sitevisit_cancelled_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:cancel:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "cancelled",
                });

                return res.status(200).json({ ok: true, handled: "confirm_cancel" });
            }

            await visit.save();
            logUnmapped({ visit, textRaw, reason: "confirm_step_no_match" });
            return res.status(200).json({ ok: true, ignored: true, reason: "unmapped_confirm" });
        }

        // =========================
        // STEP 1b: Paused (Nudge)
        // =========================
        if (visit.notify.flowStep === "paused") {
            const isContinue = textC === canon("Continue now") || textC.includes("continue");
            const isLater = textC === canon("Remind me later") || textC.includes("later") || textC.includes("remind");

            if (isContinue) {
                setStep(visit, "awaiting_readiness");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_READINESS", "tn_sitevisit_call_slots_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name],
                    callbackData: `sv_step:readiness:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "readiness",
                });

                return res.status(200).json({ ok: true, handled: "nudge_continue" });
            }

            if (isLater) {
                await visit.save();
                return res.status(200).json({ ok: true, handled: "nudge_later" });
            }

            await visit.save();
            logUnmapped({ visit, textRaw, reason: "nudge_step_no_match" });
            return res.status(200).json({ ok: true, ignored: true, reason: "unmapped_nudge" });
        }

        // =========================
        // STEP 1c: Reschedule
        // =========================
        if (visit.notify.flowStep === "awaiting_reschedule") {
            const isToday = textC === canon("Today") || textC.includes("today");
            const isTomorrow = textC === canon("Tomorrow") || textC.includes("tomorrow");
            const isWeekend = textC === canon("This weekend") || textC.includes("weekend");

            if (isToday || isTomorrow || isWeekend) {
                visit.notify.reschedulePref = textRaw;
                visit.notify.reschedulePrefAt = new Date();

                setStep(visit, "awaiting_readiness");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_READINESS", "tn_sitevisit_call_slots_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name],
                    callbackData: `sv_step:readiness:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "readiness",
                });

                return res.status(200).json({ ok: true, handled: "reschedule_to_readiness" });
            }

            await visit.save();
            logUnmapped({ visit, textRaw, reason: "reschedule_step_no_match" });
            return res.status(200).json({ ok: true, ignored: true, reason: "unmapped_reschedule" });
        }

        // =========================
        // STEP 2: Readiness / Call Slots
        // =========================
        if (visit.notify.flowStep === "awaiting_readiness") {
            const t = canon(textRaw);

            const isProceedNow = t === canon("Proceed now");
            const isLaterToday = t === canon("Later today");
            const isTomorrow = t === canon("Tomorrow");
            const isChooseDifferent = t === canon("Choose a different time");

            if (isProceedNow || isLaterToday || isTomorrow) {
                const key = isProceedNow ? "PROCEED_NOW" : isLaterToday ? "LATER_TODAY" : "TOMORROW";

                visit.notify.readinessWindowKey = key;
                visit.notify.readinessWindowLabel = textRaw;
                visit.notify.readinessWindowAt = new Date();

                setStep(visit, "awaiting_budget");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_BUDGET", "tn_sitevisit_budget_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:budget:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "budget",
                });

                return res.status(200).json({ ok: true, handled: "readiness_to_budget" });
            }

            if (isChooseDifferent) {
                visit.notify.readinessWindowKey = "CUSTOM";
                visit.notify.readinessWindowLabel = "Custom";
                visit.notify.readinessWindowAt = new Date();

                setStep(visit, "awaiting_custom_time");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_CUSTOM_TIME", "tn_sitevisit_custom_time_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:custom_time:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "custom_time",
                });

                return res.status(200).json({ ok: true, handled: "readiness_custom_time" });
            }

            await visit.save();
            return res.status(200).json({ ok: true, ignored: true, reason: "unmapped_readiness_button" });
        }

        // =========================
        // STEP 2b: Custom time
        // =========================
        if (visit.notify.flowStep === "awaiting_custom_time") {
            visit.notify.customCallWindowLabel = textRaw;
            visit.notify.customCallWindowAt = new Date();

            setStep(visit, "awaiting_budget");
            await visit.save();

            const tpl = env("INTERAKT_TEMPLATE_BUDGET", "tn_sitevisit_budget_v1");
            await sendTpl({
                visit,
                phone10,
                templateName: tpl,
                bodyValues: [name, bookingRef],
                callbackData: `sv_step:budget:${String(visit._id)}:${bookingRef}`,
                stepSentKey: "budget",
            });

            return res.status(200).json({ ok: true, handled: "custom_time_to_budget" });
        }

        // =========================
        // STEP 3: Budget
        // =========================
        if (visit.notify.flowStep === "awaiting_budget") {
            const allowed = new Set([
                canon("₹50 Lakhs – ₹1 Crore"),
                canon("₹1 Crore – ₹2 Crore"),
                canon("₹2 Crore – ₹3.5 Crore"),
                canon("Above ₹3.5 Crore"),
            ]);

            if (!allowed.has(textC)) {
                console.warn("⚠️ [BUDGET] unexpected option", { textRaw, textCanon: textC });
            }

            visit.notify.budgetRange = textRaw;
            visit.notify.budgetRangeAt = new Date();

            setStep(visit, "awaiting_timeline");
            await visit.save();

            const tpl = env("INTERAKT_TEMPLATE_TIMELINE", "tn_sitevisit_timeline_v1");
            await sendTpl({
                visit,
                phone10,
                templateName: tpl,
                bodyValues: [name, bookingRef],
                callbackData: `sv_step:timeline:${String(visit._id)}:${bookingRef}`,
                stepSentKey: "timeline",
            });

            return res.status(200).json({ ok: true, handled: "budget_to_timeline" });
        }

        // =========================
        // STEP 4: Timeline
        // =========================
        if (visit.notify.flowStep === "awaiting_timeline") {
            visit.notify.timeline = textRaw;
            visit.notify.timelineAt = new Date();

            setStep(visit, "awaiting_decision");
            await visit.save();

            const tpl = env("INTERAKT_TEMPLATE_DECISION", "tn_sitevisit_decision_v1");
            await sendTpl({
                visit,
                phone10,
                templateName: tpl,
                bodyValues: [name, bookingRef],
                callbackData: `sv_step:decision:${String(visit._id)}:${bookingRef}`,
                stepSentKey: "decision",
            });

            return res.status(200).json({ ok: true, handled: "timeline_to_decision" });
        }

        // =========================
        // STEP 5: Decision -> Summary
        // =========================
        if (visit.notify.flowStep === "awaiting_decision") {
            const allowed = new Set([
                canon("I am the decision maker"),
                canon("Joint family decision"),
                canon("Decision later"),
                canon("Just exploring"),
            ]);

            if (!allowed.has(textC)) {
                await visit.save();
                logUnmapped({ visit, textRaw, reason: "decision_step_no_match" });
                return res.status(200).json({ ok: true, ignored: true, reason: "unmapped_decision" });
            }

            visit.notify.decisionAuthority = textRaw;
            visit.notify.decisionAuthorityAt = new Date();

            setStep(visit, "awaiting_summary");
            await visit.save();

            const tpl = env("INTERAKT_TEMPLATE_SUMMARY", "tn_sitevisit_summary_proceed_v1");

            const callPref =
                visit.notify.customCallWindowLabel ||
                visit.notify.readinessWindowLabel ||
                "Not selected";

            const budget = visit.notify.budgetRange || "Not selected";
            const timeline = visit.notify.timeline || "Not selected";
            const decision = visit.notify.decisionAuthority || "Not selected";

            await sendTpl({
                visit,
                phone10,
                templateName: tpl,
                bodyValues: [name, bookingRef, callPref, budget, timeline, decision],
                callbackData: `sv_step:summary:${String(visit._id)}:${bookingRef}`,
                stepSentKey: "summary",
            });

            return res.status(200).json({ ok: true, handled: "decision_to_summary" });
        }

        // =========================
        // STEP 6: Summary -> Proceed Ack / Cancelled
        // =========================
        if (visit.notify.flowStep === "awaiting_summary") {
            const isProceed = textC === canon("Proceed") || textC.includes("proceed");
            const isCancel = textC === canon("Cancel") || textC.includes("cancel");

            if (isProceed) {
                setStep(visit, "completed");
                visit.notify.completedAt = new Date();
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_PROCEED_ACK", "tn_sitevisit_proceed_ack_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:proceed_ack:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "proceed_ack",
                });

                return res.status(200).json({ ok: true, handled: "summary_proceed" });
            }

            if (isCancel) {
                setStep(visit, "canceled");
                await visit.save();

                const tpl = env("INTERAKT_TEMPLATE_CANCELLED", "tn_sitevisit_cancelled_v1");
                await sendTpl({
                    visit,
                    phone10,
                    templateName: tpl,
                    bodyValues: [name, bookingRef],
                    callbackData: `sv_step:cancel:${String(visit._id)}:${bookingRef}`,
                    stepSentKey: "cancelled",
                });

                return res.status(200).json({ ok: true, handled: "summary_cancel" });
            }

            await visit.save();
            logUnmapped({ visit, textRaw, reason: "summary_step_no_match" });
            return res.status(200).json({ ok: true, ignored: true, reason: "unmapped_summary" });
        }

        // completed/canceled: ignore safely
        await visit.save();
        return res.status(200).json({ ok: true, ignored: true, reason: "no_matching_step" });
    } catch (err) {
        console.error("❌ [INTERAKT] webhook error", err);
        return res.status(200).json({ ok: false, error: String(err?.message || err) });
    }
}
