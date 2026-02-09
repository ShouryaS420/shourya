import cron from "node-cron";
import { assignReadyByCreationDelay, resetVendorDailyCounters } from "../services/assignmentService.js";
import {
    processSiteVisitNotifications,
    processSiteVisitStepReminders,
    processSiteVisitExpiry,
    processSiteVisitRecoverySends,
} from "../services/siteVisitNotificationService.js";

/**
 * ✅ IMPORTANT:
 * Do NOT run WhatsApp sender every second.
 * Use every 15s or every 30s. (Every minute is also fine.)
 */
cron.schedule("*/15 * * * * *", async () => {
    try {
        // 1) Initial WhatsApp notifications (welcome + confirm)
        const r = await processSiteVisitNotifications();
        if (r.welcomeSent || r.reconSent || r.welcomeFailed || r.reconFailed) {
            console.log(`[cron] WhatsApp initial: welcome=${r.welcomeSent}, recon=${r.reconSent}, wFail=${r.welcomeFailed}, rFail=${r.reconFailed}`);
        }

        // 2) Step reminders (real-life: user delays)
        const rr = await processSiteVisitStepReminders();
        if (rr.sent || rr.skipped) {
            console.log(`[cron] WhatsApp reminders: sent=${rr.sent}, skipped=${rr.skipped}`);
        }

        // 3) Recovery sends (if a step advanced but template did not go out due to crash)
        const rec = await processSiteVisitRecoverySends();
        if (rec.sent || rec.fixed) {
            console.log(`[cron] WhatsApp recovery: sent=${rec.sent}, fixed=${rec.fixed}`);
        }

        // 4) Assignment
        const n = await assignReadyByCreationDelay();
        if (n > 0) console.log(`[cron] Assigned ${n} site visit(s) via round-robin (delay-window)`);
    } catch (err) {
        console.error("[cron] error:", err?.message || err);
    }
});

// Daily reset (kept)
cron.schedule("30 18 * * *", async () => {
    try {
        await resetVendorDailyCounters();
        console.log("[cron] Vendor assignedToday reset");
    } catch (err) {
        console.error("[cron] resetVendorDailyCounters error:", err?.message || err);
    }
});

/**
 * Expiry job: run every 2 hours (stops ancient flows cleanly)
 */
cron.schedule("0 */2 * * *", async () => {
    try {
        const ex = await processSiteVisitExpiry();
        if (ex.expired) console.log(`[cron] SiteVisit expired: ${ex.expired}`);
    } catch (err) {
        console.error("[cron] processSiteVisitExpiry error:", err?.message || err);
    }
});

export function initCron() {
    console.log("[cron] Schedulers initialized");
}
