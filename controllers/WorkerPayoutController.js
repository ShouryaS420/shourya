import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import { getPreviousWeekRange } from "../utils/weekUtils.js";

export const getPreviousWeekPayout = async (req, res) => {
    try {
        const workerId = req.vendor._id;

        const { start, label } = getPreviousWeekRange(new Date());

        // IMPORTANT:
        // Use frozen weekly settlement record (same record admin will mark FINAL/PAID)
        const settlement = await WorkerWeeklySettlement.findOne({
            workerId,
            weekStart: start,
        });

        if (!settlement) {
            return res.json({
                success: true,
                payoutRange: label,
                grossPay: 0,
                overtimePay: 0,
                bonuses: 0,
                advances: 0,
                penalties: 0,
                netPay: 0,
                status: "UNPAID",
                paidAt: null,
            });
        }

        return res.json({
            success: true,
            payoutRange: label,
            grossPay: settlement.grossPay || 0,
            overtimePay: settlement.overtimePay || 0,
            bonuses: settlement.bonusTotal || settlement.complianceBonusTotal || 0,
            advances: settlement.advanceTotal || 0,
            penalties: settlement.penaltyTotal || 0,
            netPay: settlement.netPay || 0,
            status: settlement.status?.state || settlement.status || "UNPAID",
            paidAt: settlement.status?.paidAt || null,
        });
    } catch (e) {
        console.error("Previous payout error:", e);
        return res.status(500).json({ success: false, message: "Failed to load payout" });
    }
};
