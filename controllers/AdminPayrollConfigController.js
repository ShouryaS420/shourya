import PayrollConfig from "../models/PayrollConfig.js";

function defaultConfig() {
    return {
        shifts: {
            A: { code:"A", startHHMM:"07:00", endHHMM:"19:00", multiplier:1.5 },
            C: { start: "10:00", end: "18:00", multiplier: 1.0 },
        },
        graceMinsLate: 10,
        wageMatrix: {
            HELPER: { L1: 0, L2: 0, L3: 0, L4: 0 },
            SEMISKILLED: { L1: 0, L2: 0, L3: 0, L4: 0 },
            SKILLED: { L1: 0, L2: 0, L3: 0, L4: 0 },
        },
        dailyComplianceBonusAmount: 50,
        attendanceStreakBonus: {
            HELPER: 50,
            SEMISKILLED: 70,
            SKILLED: 100,
        },
    };
}

// GET /api/admin/payroll/config
export async function getPayrollConfig(req, res) {
    const config = await PayrollConfig.findOne({ key: "ACTIVE" }).lean();
    console.log(config);
    if (!config) return res.json(defaultConfig());
    return res.json(config);
}

// POST /api/admin/payroll/config
export async function savePayrollConfig(req, res) {
    try {
        const adminId = req.admin?._id;
        const body = req.body || {};

        // Validate minimal fields exist
        if (!body.shifts?.A || !body.shifts?.C) {
            return res.status(400).json({ error: "Missing shifts A/C" });
        }
        if (!body.wageMatrix?.HELPER || !body.wageMatrix?.SEMISKILLED || !body.wageMatrix?.SKILLED) {
            return res.status(400).json({ error: "Missing wageMatrix" });
        }

        // ✅ Normalize shifts (support both old UI keys and schema keys)
        const normalizeShift = (code, s) => ({
            code,
            startHHMM: s.startHHMM || s.start || "00:00",
            endHHMM: s.endHHMM || s.end || "00:00",
            multiplier: Number(s.multiplier ?? 1),
        });

        const normalized = {
            key: "ACTIVE", // ✅ keep one active config
            graceMinsLate: Number(body.graceMinsLate ?? 0),
            dailyComplianceBonusAmount: Number(body.dailyComplianceBonusAmount ?? 50),

            shifts: {
                A: normalizeShift("A", body.shifts.A),
                C: normalizeShift("C", body.shifts.C),
            },

            wageMatrix: body.wageMatrix,
            attendanceStreakBonus: body.attendanceStreakBonus || undefined, // only if schema supports it
            updatedBy: adminId,
            updatedAt: new Date(),
        };

        // ✅ Use single ACTIVE doc (no active:true switching)
        const cfg = await PayrollConfig.findOneAndUpdate(
            { key: "ACTIVE" },
            { $set: normalized },
            { upsert: true, new: true, runValidators: true }
        );

        return res.json({ success: true, config: cfg });
    } catch (e) {
        console.error("savePayrollConfig:", e);
        return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
}
