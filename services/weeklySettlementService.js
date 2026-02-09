// services/weeklySettlementService.js
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import { getActivePayrollConfig, getBasicDailyWageFromMatrix } from "./payrollConfigService.js";
import { computeAttendance30Bonus } from "./attendanceBonusService.js";

/**
 * Utility: get Monday of current IST week
 */
export function getCurrentWeekStartKey() {
    const now = new Date();
    const ist = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const day = ist.getDay(); // 0=Sun,1=Mon,...6=Sat
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    ist.setDate(ist.getDate() + diff);

    return ist.toISOString().slice(0, 10);
}

function addDays(dateKey, n) {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

/**
 * Compute or load weekly settlement
 */
export async function computeWeeklySettlement({ worker, weekStartKey }) {
    const cfg = await getActivePayrollConfig();

    const startKey = weekStartKey || getCurrentWeekStartKey();
    const endKey = addDays(startKey, 5); // Monday to Saturday

    // If already finalized/paid, return frozen record
    const existing = await WorkerWeeklySettlement.findOne({
        workerId: worker._id,
        weekStartKey: startKey,
    });

    if (existing && existing.locked) {
        return existing;
    }

    // Load daily engine records
    const days = await WorkerWorkDay.find({
        workerId: worker._id,
        dateKey: { $gte: startKey, $lte: endKey },
    }).lean();

    let shiftA_days = 0;
    let shiftC_days = 0;
    let subshift_days = 0;
    let absent_days = 0;

    let grossPay = 0;
    let complianceBonusTotal = 0;

    for (const d of days) {
        if (d.actualOutcome === "A_FULL") shiftA_days++;
        else if (d.actualOutcome === "C_FULL") shiftC_days++;
        else if (d.actualOutcome === "SUBSHIFT") subshift_days++;
        else if (d.actualOutcome === "ABSENT") absent_days++;

        grossPay += Number(d.dayWage || 0);
        complianceBonusTotal += Number(d.dayBonus || 0);

        // Leadership & other incentive events for this week
        const incentiveEvents = await WorkerIncentiveEvent.find({
            workerId: worker._id,
            effectiveDateKey: { $gte: startKey, $lte: endKey },
            status: "APPROVED",
        }).lean();

        let incentiveTotal = 0;
        for (const e of incentiveEvents) incentiveTotal += Number(e.amount || 0);
    }

    const daysWorked = shiftA_days + shiftC_days + subshift_days;

    // Attendance 30-day bonus not implemented yet in this phase
    // Phase 4 — Attendance 30-day regular bonus
    let attendance30Bonus = 0;

    try {
        const bonusResult = await computeAttendance30Bonus({
            worker,
            uptoDateKey: endKey,
        });

        if (bonusResult.eligible) {
            attendance30Bonus = bonusResult.amount;

            // Mark awarded on worker profile (very important)
            worker.lastAttendanceBonusAwardedAt = new Date();
            worker.attendanceStreakCount = 30;
            await worker.save();
        }
    } catch (e) {
        console.error("[Attendance30Bonus] compute failed:", e?.message || e);
    }

    const netPay = grossPay + complianceBonusTotal + attendance30Bonus + incentiveTotal;

    // Snapshot wage config
    const basicDailyWageUsed = getBasicDailyWageFromMatrix(
        cfg,
        worker.skillCategory,
        worker.skillLevel
    );

    const snapshot = {
        skillCategory: worker.skillCategory,
        skillLevel: worker.skillLevel,
        basicDailyWageUsed,
        shiftA_multiplier: cfg.shifts.A.multiplier,
        shiftC_multiplier: cfg.shifts.C.multiplier,
    };

    const doc = await WorkerWeeklySettlement.findOneAndUpdate(
        { workerId: worker._id, weekStartKey: startKey },
        {
            $set: {
                workerId: worker._id,
                weekStartKey: startKey,
                weekEndKey: endKey,

                daysWorked,
                shiftA_days,
                shiftC_days,
                subshift_days,
                absent_days,

                grossPay,
                complianceBonusTotal,
                attendance30Bonus,
                netPay,

                wageSnapshot: snapshot,

                "status.state": "DRAFT",
                locked: false,
            },
        },
        { new: true, upsert: true }
    );

    return doc;
}
