// controllers/VendorPayrollController.js
import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import { computeWeeklySettlement } from "../services/weeklySettlementService.js";

/**
 * GET /api/vendor/payroll/week
 * Query: ?weekStart=YYYY-MM-DD (optional)
 */
export async function getMyWeekPayroll(req, res) {
    try {
        const worker = req.vendor;
        const { weekStart } = req.query;

        const settlement = await computeWeeklySettlement({
            worker,
            weekStartKey: weekStart,
        });

        return res.json({
            success: true, // ✅ add this
            weekStart: settlement.weekStartKey,
            weekEnd: settlement.weekEndKey,

            summary: {
                daysWorked: settlement.daysWorked,
                shiftA_days: settlement.shiftA_days,
                shiftC_days: settlement.shiftC_days,
            },

            money: {
                grossPay: settlement.grossPay,
                bonuses: settlement.complianceBonusTotal + settlement.attendance30Bonus,
                netPay: settlement.netPay,
            },

            bonusBreakdown: {
                complianceBonusTotal: settlement.complianceBonusTotal,
                attendance30Bonus: settlement.attendance30Bonus,
            },

            status: settlement.status,
        });
    } catch (e) {
        console.error("getMyWeekPayroll error:", e);
        return res.status(500).json({ message: "Failed to compute payroll" });
    }
}

/**
 * GET /api/vendor/payroll/history
 */
export const getMyPayrollHistory = async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(Number(req.query.limit || 12), 52));

        const vendorId = req.vendor?._id;

        const items = await WorkerWeeklySettlement.find({ workerId: vendorId })
            .sort({ weekStartKey: -1 })
            .limit(limit)
            .lean();

        return res.json({
            success: true,
            items,
        });
    } catch (e) {
        console.error("getMyPayrollHistory error:", e);
        return res.status(500).json({
            success: false,
            message: "Failed to load payroll history",
        });
    }
};
