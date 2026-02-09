// services/payrollConfigService.js
import PayrollConfig from "../models/PayrollConfig.js";

const DEFAULT_WAGE_MATRIX = {
    HELPER: { L1: 600, L2: 650, L3: 700, L4: 750 },
    SEMISKILLED: { L1: 750, L2: 800, L3: 850, L4: 900 },
    SKILLED: { L1: 900, L2: 1000, L3: 1100, L4: 1200 },
};

export async function getActivePayrollConfig() {
    let cfg = await PayrollConfig.findOneAndUpdate(
        { key: "ACTIVE" },
        { $setOnInsert: { key: "ACTIVE" } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const wm = cfg?.wageMatrix || {};
    const helperL1 = Number(wm?.HELPER?.L1 ?? 0);
    const helperL2 = Number(wm?.HELPER?.L2 ?? 0);

    const needsBootstrap = helperL1 <= 0 || helperL2 <= 0;

    if (needsBootstrap) {
        cfg = await PayrollConfig.findOneAndUpdate(
            { key: "ACTIVE" },
            {
                $set: {
                    // ✅ Always set default wages if they are missing/0
                    "wageMatrix.HELPER": { ...DEFAULT_WAGE_MATRIX.HELPER, ...(wm.HELPER || {}) },
                    "wageMatrix.SEMISKILLED": { ...DEFAULT_WAGE_MATRIX.SEMISKILLED, ...(wm.SEMISKILLED || {}) },
                    "wageMatrix.SKILLED": { ...DEFAULT_WAGE_MATRIX.SKILLED, ...(wm.SKILLED || {}) },
                },
            },
            { new: true }
        );
    }

    return cfg;
}

export function getBasicDailyWageFromMatrix(cfg, skillCategory, skillLevel) {
    const cat = (skillCategory || "").toUpperCase();
    const lvl = `L${Number(skillLevel || 1)}`;

    const row = cfg?.wageMatrix?.[cat];
    const value = Number(row?.[lvl] ?? 0);
    if (value > 0) return value;

    const fallback = Number(row?.L1 ?? 0);
    if (fallback > 0) return fallback;

    throw new Error(`Wage matrix missing for ${cat} ${lvl}. Please set PayrollConfig.wageMatrix.`);
}
