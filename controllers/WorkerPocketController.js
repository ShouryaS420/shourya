import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import { computeWeeklySettlement, getCurrentWeekStartKey } from "../services/weeklySettlementService.js";

const addDaysKey = (dateKey, n) => {
    const d = new Date(`${dateKey}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
};

/**
 * Pocket summary for worker
 * Shows:
 * - current week earnings (live engine)
 * - previous week payout (frozen record if locked)
 *
 * Business week: Monday → Saturday
 * Previous week start = currentWeekStartKey - 7 days (Mon to Mon)
 */
export const getPocketSummary = async (req, res) => {
    try {
        const worker = req.vendor;
        if (!worker?._id) return res.status(401).json({ success: false, message: "Unauthorized" });

        const currStartKey = getCurrentWeekStartKey();
        const prevStartKey = addDaysKey(currStartKey, -7);

        // Current week (live engine)
        const currentWeek = await computeWeeklySettlement({ worker, weekStartKey: currStartKey });

        // Previous week (prefer locked)
        const previousWeek = await WorkerWeeklySettlement.findOne({
            workerId: worker._id,
            weekStartKey: prevStartKey,
            locked: true,
        }).lean();

        return res.json({
            success: true,
            currentWeek: {
                weekStartKey: currentWeek.weekStartKey,
                weekEndKey: currentWeek.weekEndKey,
                earningsAmount: Number(currentWeek.netPay || 0),
                status: currentWeek.status?.state || "DRAFT",
                locked: !!currentWeek.locked,
            },
            previousPayout: {
                weekStartKey: prevStartKey,
                weekEndKey: addDaysKey(prevStartKey, 5),
                amount: Number(previousWeek?.netPay || 0),
                status: previousWeek?.status?.state || "UNPAID",
                locked: !!previousWeek?.locked,
            },
        });
    } catch (e) {
        console.error("Pocket summary error:", e);
        return res.status(500).json({ success: false, message: "Failed to load pocket summary" });
    }
};
