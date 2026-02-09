// services/workerWorkDayService.js
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import { getActivePayrollConfig, getBasicDailyWageFromMatrix } from "./payrollConfigService.js";

/**
 * Utility: parse "HH:MM" into minutes from midnightx
 */
function hhmmToMinutes(hhmm) {
    const [h, m] = String(hhmm).split(":").map((x) => Number(x));
    return (h * 60) + (m || 0);
}

/**
 * Utility: get minutes-from-midnight in IST for a Date
 */
function dateToIstMinutes(d) {
    // Convert to IST by formatting hour/min
    const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(d);

    const hh = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const mm = Number(parts.find((p) => p.type === "minute")?.value || 0);
    return (hh * 60) + mm;
}

/**
 * Decide if day is FULL or SUBSHIFT based on checkout time vs shift end.
 * We avoid "minutes worked" logic; only time boundary logic.
 */
function computeOutcome(expectedShift, cfg, checkInAt, checkOutAt) {
    if (!checkInAt || !checkOutAt) return "ABSENT";

    const shift = cfg.shifts?.[expectedShift];
    if (!shift) return "SUBSHIFT";

    const endM = hhmmToMinutes(shift.endHHMM);
    const outM = dateToIstMinutes(checkOutAt);

    // If checkout earlier than shift end -> subshift (special case)
    // (You can add a grace here later if needed)
    if (outM < endM) return "SUBSHIFT";

    // Otherwise treat as full shift
    return expectedShift === "A" ? "A_FULL" : "C_FULL";
}

function computeOnTime(expectedShift, cfg, checkInAt) {
    if (!checkInAt) return false;
    const shift = cfg.shifts?.[expectedShift];
    if (!shift) return false;

    const startM = hhmmToMinutes(shift.startHHMM);
    const inM = dateToIstMinutes(checkInAt);

    const grace = Number(cfg.graceMinsLate || 0);
    return inM <= (startM + grace);
}

function computeDayWage(basicDailyWage, expectedShift, outcome, cfg) {
    // Base multiplier from main shift
    const mult = Number(cfg.shifts?.[expectedShift]?.multiplier || 1);

    // Full shift uses multiplier; subshift falls back to 1.0×
    if (outcome === "SUBSHIFT") return Math.round(basicDailyWage * 1.0);

    return Math.round(basicDailyWage * mult);
}

export async function upsertWorkerWorkDayFromAttendance({
    worker,
    dateKey,
    attendanceSessionId,
    checkInAt,
    checkOutAt,
}) {
    const cfg = await getActivePayrollConfig();

    // Worker skill profile (we will add these fields on VendorUsers)
    const skillCategory = worker?.skillCategory || "HELPER";
    const skillLevel = worker?.skillLevel || 1;

    // Shift selection (worker has default shift A or C)
    const expectedShift = worker?.defaultShift || "C";

    const basicDailyWage = getBasicDailyWageFromMatrix(cfg, skillCategory, skillLevel);

    const outcome = computeOutcome(expectedShift, cfg, checkInAt, checkOutAt);
    const onTime = computeOnTime(expectedShift, cfg, checkInAt);

    // Safety default true (can be overridden later by supervisor endpoint)
    const safetyCompliant = true;

    const dayWage = computeDayWage(basicDailyWage, expectedShift, outcome, cfg);

    const dayBonus =
        (onTime && safetyCompliant)
            ? Number(cfg.dailyComplianceBonusAmount || 50)
            : 0;

    const dayTotal = dayWage + dayBonus;

    const update = {
        workerId: worker._id,
        dateKey,
        expectedShift,
        actualOutcome: outcome,
        onTime,
        safetyCompliant,
        dayWage,
        dayBonus,
        dayTotal,
        checkInAt,
        checkOutAt,
        sourceSessionId: attendanceSessionId,
    };

    // Do not overwrite locked records
    const existing = await WorkerWorkDay.findOne({ workerId: worker._id, dateKey }).select("locked");
    if (existing?.locked) return { skipped: true, reason: "LOCKED" };

    const doc = await WorkerWorkDay.findOneAndUpdate(
        { workerId: worker._id, dateKey },
        { $set: update, $setOnInsert: { locked: false } },
        { new: true, upsert: true }
    );

    return { success: true, workDay: doc };
}
