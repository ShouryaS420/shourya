import VendorUser from "../models/VendorUsers.js"; // adjust path/name if different

export async function updateWorkerPayrollProfile(req, res) {
    const { id } = req.params; // workerId/vendorId depending on your naming
    const { payrollEnabled, defaultShift, skillCategory, skillLevel } = req.body || {};

    // Validate
    if (typeof payrollEnabled !== "boolean") {
        return res.status(400).json({ error: "payrollEnabled must be boolean" });
    }
    if (!["A", "C"].includes(defaultShift)) {
        return res.status(400).json({ error: "defaultShift must be A or C" });
    }
    if (!["HELPER", "SEMISKILLED", "SKILLED"].includes(skillCategory)) {
        return res.status(400).json({ error: "skillCategory invalid" });
    }
    if (![1, 2, 3, 4].includes(Number(skillLevel))) {
        return res.status(400).json({ error: "skillLevel must be 1..4" });
    }

    const worker = await VendorUser.findByIdAndUpdate(
        id,
        {
            $set: {
                payrollEnabled,
                defaultShift,
                skillCategory,
                skillLevel: Number(skillLevel),
            },
        },
        { new: true }
    ).lean();

    if (!worker) return res.status(404).json({ error: "Worker not found" });

    return res.json({ success: true, worker });
}
