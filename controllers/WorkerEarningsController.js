import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import { computeWeeklySettlement, getCurrentWeekStartKey } from "../services/weeklySettlementService.js";

// reuse your existing addDays helper (copy it here if not exported)
function addDays(dateKey, n) {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

// ---------- Utilities (IST-safe date keys) ----------
const istDateKey = (d = new Date()) => {
    // produces YYYY-MM-DD in Asia/Kolkata
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(d);

    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    return `${y}-${m}-${day}`;
};

const istMonthRangeKeys = (d = new Date()) => {
    // month start/end keys in IST
    const nowKey = istDateKey(d);
    const [yy, mm] = nowKey.split("-").map((x) => Number(x));

    const start = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
    const startKey = istDateKey(start);

    // end = last day of month
    const nextMonth = new Date(Date.UTC(yy, mm, 1, 0, 0, 0));
    nextMonth.setUTCDate(nextMonth.getUTCDate() - 1);
    const endKey = istDateKey(nextMonth);

    return { startKey, endKey };
};

// ---------- 1) Current Week (LIVE engine output) ----------
export const getCurrentWeekEarnings = async (req, res) => {
    try {
        const worker = req.vendor; // vendor auth sets req.vendor
        if (!worker?._id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const weekStartKey = getCurrentWeekStartKey(); // already Mon–Sat aligned
        const settlement = await computeWeeklySettlement({ worker, weekStartKey });

        return res.json({
            success: true,
            weekStartKey: settlement.weekStartKey,
            weekEndKey: settlement.weekEndKey,
            daysWorked: Number(settlement.daysWorked || 0),
            grossPay: Number(settlement.grossPay || 0),
            complianceBonusTotal: Number(settlement.complianceBonusTotal || 0),
            attendance30Bonus: Number(settlement.attendance30Bonus || 0),
            netPay: Number(settlement.netPay || 0),
            status: settlement.status?.state || "DRAFT",
            locked: !!settlement.locked,
        });
    } catch (e) {
        console.error("getCurrentWeekEarnings error:", e);
        return res.status(500).json({ success: false, message: "Failed to load current week earnings" });
    }
};

// ---------- 2) TODAY (Home screen) ----------
export const getTodayEarnings = async (req, res) => {
    try {
        const workerId = req.vendor?._id;
        if (!workerId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const dateKey = istDateKey(new Date());

        const day = await WorkerWorkDay.findOne({
            workerId,
            dateKey,
        }).lean();

        if (!day) {
            return res.json({
                success: true,
                dateKey,
                status: "NO_RECORD",
                todayEarning: 0,
                // Keep UI contract stable (Phase 4 can update these with real supervisor inputs)
                dailyAttendanceBonus: 0,
                safetyBonus: 0,
                workedDays: 0,
                onTime: null,
                safetyCompliant: null,
                actualOutcome: null,
                checkInAt: null,
                checkOutAt: null,
            });
        }

        const workedDays = day.actualOutcome === "ABSENT" ? 0 : 1;

        // Base earning = wage + any generic dayBonus your system already calculates
        const baseEarning = Number(day.dayWage || 0) + Number(day.dayBonus || 0);

        // If your schema already contains explicit bonuses, use them.
        // If not present, they safely default to 0 (truthful).
        const dailyAttendanceBonus =
            Number(day.attendanceBonus || 0) ||
            Number(day.attendance30Bonus || 0) ||
            0;

        const safetyBonus =
            Number(day.safetyBonus || 0) ||
            0;

        // Final today total shown to worker = base + explicit bonuses (if they exist)
        // If your dayBonus already includes attendance/safety, then keep them as 0 to avoid double count.
        // Here we assume explicit fields are separate; if not used, they remain 0.
        const todayEarning = baseEarning + dailyAttendanceBonus + safetyBonus;

        return res.json({
            success: true,
            dateKey,
            status: day.actualOutcome === "ABSENT" ? "ABSENT" : "WORKED",
            todayEarning,
            // For now these are 0 until supervisor bonus modules are added (later phase)
            dailyAttendanceBonus,
            safetyBonus,
            workedDays,
            onTime: day.onTime ?? null,
            safetyCompliant: day.safetyCompliant ?? null,
            actualOutcome: day.actualOutcome ?? null,
            checkInAt: day.checkInAt || null,
            checkOutAt: day.checkOutAt || null,
            locked: !!day.locked,
        });
    } catch (e) {
        console.error("getTodayEarnings error:", e);
        return res.status(500).json({ success: false, message: "Failed to load today's earnings" });
    }
};

// ---------- 3) CURRENT MONTH SUMMARY (Pocket screen) ----------
export const getCurrentMonthEarnings = async (req, res) => {
    try {
        const workerId = req.vendor?._id;
        if (!workerId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { startKey, endKey } = istMonthRangeKeys(new Date());

        const days = await WorkerWorkDay.find({
            workerId,
            dateKey: { $gte: startKey, $lte: endKey },
        }).lean();

        let daysWorked = 0;
        let absentDays = 0;

        let grossPay = 0; // dayWage sum
        let complianceBonusTotal = 0; // dayBonus sum

        for (const d of days) {
            const outcome = d.actualOutcome;
            if (outcome === "ABSENT") absentDays++;
            else daysWorked++;

            grossPay += Number(d.dayWage || 0);
            complianceBonusTotal += Number(d.dayBonus || 0);
        }

        const netEarned = grossPay + complianceBonusTotal;

        return res.json({
            success: true,
            monthStartKey: startKey,
            monthEndKey: endKey,
            daysWorked,
            absentDays,
            grossPay,
            complianceBonusTotal,
            netEarned,
        });
    } catch (e) {
        console.error("getCurrentMonthEarnings error:", e);
        return res.status(500).json({ success: false, message: "Failed to load current month earnings" });
    }
};

// ---------- 4) HISTORY (Detailed History screen) ----------
// GET /api/vendor/worker/earnings/history?from=YYYY-MM-DD&to=YYYY-MM-DD&type=daily|weekly
export const getEarningsHistory = async (req, res) => {
    try {
        const workerId = req.vendor?._id;
        if (!workerId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { from, to, type } = req.query;

        // defaults: last 30 days daily
        const now = new Date();
        const defaultTo = istDateKey(now);
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const defaultFrom = istDateKey(d30);

        const fromKey = String(from || defaultFrom);
        const toKey = String(to || defaultTo);
        const mode = String(type || "daily");

        if (mode === "weekly") {
            const items = await WorkerWeeklySettlement.find({
                workerId,
                weekStartKey: { $gte: fromKey, $lte: toKey },
            })
                .sort({ weekStartKey: -1 })
                .limit(80)
                .lean();

            return res.json({ success: true, type: "weekly", fromKey, toKey, items });
        }

        // daily (default)
        const items = await WorkerWorkDay.find({
            workerId,
            dateKey: { $gte: fromKey, $lte: toKey },
        })
            .sort({ dateKey: -1 })
            .limit(200)
            .lean();

        // Optional: add computed total per day for UI convenience
        const mapped = items.map((d) => ({
            ...d,
            dayTotal: Number(d.dayWage || 0) + Number(d.dayBonus || 0),
        }));

        return res.json({ success: true, type: "daily", fromKey, toKey, items: mapped });
    } catch (e) {
        console.error("getEarningsHistory error:", e);
        return res.status(500).json({ success: false, message: "Failed to load earnings history" });
    }
};

/**
 * HOME Weekly Summary (Mon→Sat, IST)
 * GET /api/vendor/worker/earnings/home-week
 */
export const getHomeWeekSummary = async (req, res) => {
    try {
        const workerId = req.vendor?._id;
        if (!workerId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const weekStartKey = getCurrentWeekStartKey(); // Mon (IST)
        const weekEndKey = addDays(weekStartKey, 5);   // Sat (IST)

        const days = await WorkerWorkDay.find({
            workerId,
            dateKey: { $gte: weekStartKey, $lte: weekEndKey },
        }).lean();

        let workedDays = 0;

        let weeklyWage = 0;               // sum of dayWage
        let weeklyBonusOther = 0;         // sum of dayBonus (generic compliance bonus)
        let weeklyAttendanceBonus = 0;    // sum attendance bonus field if exists
        let weeklySafetyBonus = 0;        // sum safety bonus field if exists

        for (const d of days) {
            const outcome = d.actualOutcome;
            const isAbsent = outcome === "ABSENT";
            if (!isAbsent) workedDays += 1;

            weeklyWage += Number(d.dayWage || 0);
            weeklyBonusOther += Number(d.dayBonus || 0);

            // If your schema has these, we sum them.
            // If not present, they stay 0 (safe).
            weeklyAttendanceBonus +=
                Number(d.attendanceBonus || 0) ||
                Number(d.attendance30Bonus || 0) ||
                0;

            weeklySafetyBonus += Number(d.safetyBonus || 0) || 0;
        }

        // Weekly total earning shown on card:
        // If dayBonus already includes safety/attendance, keep those fields 0 to avoid double-counting.
        // For now we use: wage + dayBonus + explicitAttendance + explicitSafety.
        const weeklyEarning =
            weeklyWage + weeklyBonusOther + weeklyAttendanceBonus + weeklySafetyBonus;

        return res.json({
            success: true,
            weekStartKey,
            weekEndKey,
            weeklyEarning,
            weeklyAttendanceBonus,
            weeklySafetyBonus,
            workedDays,
        });
    } catch (e) {
        console.error("getHomeWeekSummary error:", e);
        return res.status(500).json({ success: false, message: "Failed to load weekly summary" });
    }
};

