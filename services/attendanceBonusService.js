// services/attendanceBonusService.js
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import { getActivePayrollConfig } from "./payrollConfigService.js";

/**
 * Check rolling 30 working days attendance and award bonus if eligible
 */
export async function computeAttendance30Bonus({ worker, uptoDateKey }) {
    const cfg = await getActivePayrollConfig();

    // If already awarded recently, skip (simple protection)
    if (worker.lastAttendanceBonusAwardedAt) {
        const last = new Date(worker.lastAttendanceBonusAwardedAt);
        const now = new Date();

        const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
            return { eligible: false, reason: "RECENTLY_AWARDED" };
        }
    }

    // Get last 40 workdays to safely check rolling 30
    const days = await WorkerWorkDay.find({
        workerId: worker._id,
        actualOutcome: { $ne: "ABSENT" },
    })
        .sort({ dateKey: -1 })
        .limit(40)
        .lean();

    if (days.length < 30) {
        return { eligible: false, reason: "INSUFFICIENT_DAYS", count: days.length };
    }

    // Take latest 30 working days
    const streak = days.slice(0, 30);

    // Validate all are valid working days
    for (const d of streak) {
        if (d.actualOutcome === "ABSENT") {
            return { eligible: false, reason: "BREAK_IN_STREAK" };
        }
    }

    // Eligible → determine bonus by skill
    const skill = (worker.skillCategory || "").toUpperCase();

    const amount =
        cfg.attendance30BonusBySkill?.[skill] ||
        0;

    if (amount <= 0) {
        return { eligible: false, reason: "NO_BONUS_CONFIG" };
    }

    return {
        eligible: true,
        amount,
        daysCounted: 30,
    };
}
