import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";

const clampLimit = (n, min = 1, max = 52) => Math.max(min, Math.min(Number(n || 12), max));

export async function listWorkerWorkDays(req, res) {
    try {
        const { workerId } = req.params;

        // Date range optional
        const from = String(req.query.from || "");
        const to = String(req.query.to || "");

        // Default: last 14 days (simple + safe)
        // Note: dateKey is stored as "YYYY-MM-DD" so lexicographic range works.
        function toDateKey(d) {
            return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
        }

        let fromKey = from;
        let toKey = to;

        if (!fromKey || !toKey) {
            const now = new Date();
            const end = toDateKey(now);
            const startDt = new Date(now);
            startDt.setDate(startDt.getDate() - 13);
            const start = toDateKey(startDt);

            fromKey = fromKey || start;
            toKey = toKey || end;
        }

        const items = await WorkerWorkDay.find({
            workerId,
            dateKey: { $gte: fromKey, $lte: toKey },
        })
            .sort({ dateKey: 1 })
            .lean();

        return res.json({
            success: true,
            range: { from: fromKey, to: toKey },
            items,
        });
    } catch (e) {
        console.error("listWorkerWorkDays:", e);
        return res.status(500).json({ success: false, message: e?.message || "Server error" });
    }
}

export async function listWorkerSettlements(req, res) {
    try {
        const { workerId } = req.params;
        const limit = clampLimit(req.query.limit);

        const items = await WorkerWeeklySettlement.find({ workerId })
            .sort({ weekStartKey: -1 })
            .limit(limit)
            .lean();

        return res.json({ success: true, items });
    } catch (e) {
        console.error("listWorkerSettlements:", e);
        return res.status(500).json({ success: false, message: "Failed to load settlements" });
    }
}

export async function finalizeSettlement(req, res) {
    try {
        const { id } = req.params;

        const settlement = await WorkerWeeklySettlement.findById(id);
        if (!settlement) {
            return res.status(404).json({ success: false, message: "Settlement not found" });
        }

        // If already paid/final, do nothing
        const state = settlement?.status?.state || settlement?.status || "DRAFT";
        if (state === "PAID") {
            return res.json({ success: true, item: settlement, message: "Already paid" });
        }

        // Freeze
        settlement.status = {
            ...(typeof settlement.status === "object" ? settlement.status : {}),
            state: "FINAL",
            finalizedAt: new Date(),
        };

        await settlement.save();
        return res.json({ success: true, item: settlement });
    } catch (e) {
        console.error("finalizeSettlement:", e);
        return res.status(500).json({ success: false, message: "Failed to finalize" });
    }
}

export async function markSettlementPaid(req, res) {
    try {
        const { id } = req.params;
        const { paidMode, paidRef, note } = req.body || {};

        if (!paidMode) {
            return res.status(400).json({ success: false, message: "paidMode is required" });
        }

        const settlement = await WorkerWeeklySettlement.findById(id);
        if (!settlement) {
            return res.status(404).json({ success: false, message: "Settlement not found" });
        }

        const state = settlement?.status?.state || settlement?.status || "DRAFT";
        if (state !== "FINAL" && state !== "PAID") {
            return res.status(400).json({
                success: false,
                message: "Settlement must be FINAL before marking PAID",
            });
        }

        settlement.status = {
            ...(typeof settlement.status === "object" ? settlement.status : {}),
            state: "PAID",
            paidAt: new Date(),
            paidMode,
            paidRef: paidRef || "",
            note: note || "",
        };

        await settlement.save();
        return res.json({ success: true, item: settlement });
    } catch (e) {
        console.error("markSettlementPaid:", e);
        return res.status(500).json({ success: false, message: "Failed to mark paid" });
    }
}
