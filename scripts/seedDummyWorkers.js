import mongoose from "mongoose";
import VendorUsers from "../models/VendorUsers.js";
import WorkerCareerProfile from "../models/WorkerCareerProfile.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";

const TZ = "Asia/Kolkata";

function istDateKey(d = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(d);

    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return `${y}-${m}-${day}`;
}

function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function rand() {
    return Math.random();
}

function uniqueMobile(i) {
    // 50 numbers: 9000002000–9000002049
    return `900000${String(2000 + i).padStart(4, "0")}`;
}

// IMPORTANT: keep skill strings aligned with your leadership requiredSkills.
const SKILL_POOL = {
    BASIC: ["helper", "material_handling", "cleaning"],
    SHUTTERING: ["shuttering_assist", "shuttering", "scaffolding"],
    REBAR: ["bar_bending", "cutting_bending"],
    SLAB: ["slab_work", "concrete_pour", "vibrator_operator"],
    FINISH: ["plastering", "finishing", "tile_work"],
    QC: ["quality_check", "rework_prevention"],
};

function union(...arrs) {
    return Array.from(new Set(arrs.flat()));
}

function skillsForTier(tier) {
    if (tier === "BRONZE") return SKILL_POOL.BASIC;

    if (tier === "SILVER")
        return union(SKILL_POOL.BASIC, ["shuttering_assist", "scaffolding"]);

    if (tier === "GOLD")
        return union(SKILL_POOL.BASIC, ["shuttering", "bar_bending", "scaffolding"]);

    if (tier === "PLATINUM")
        return union(SKILL_POOL.BASIC, SKILL_POOL.SHUTTERING, ["slab_work", "concrete_pour", "quality_check"]);

    // DIAMOND
    return union(SKILL_POOL.BASIC, SKILL_POOL.SHUTTERING, SKILL_POOL.REBAR, SKILL_POOL.SLAB, SKILL_POOL.FINISH, SKILL_POOL.QC);
}

/**
 * Ladder performance policy:
 * As tier increases, absentProb decreases, onTimeProb increases, safetyProb increases.
 * Small controlled noise remains to test policies.
 */
function perfForTier(tier) {
    switch (tier) {
        case "BRONZE":
            return { absentProb: 0.28, onTimeProb: 0.55, safetyProb: 0.65, streakBonus: 10 };
        case "SILVER":
            return { absentProb: 0.18, onTimeProb: 0.65, safetyProb: 0.78, streakBonus: 25 };
        case "GOLD":
            return { absentProb: 0.12, onTimeProb: 0.75, safetyProb: 0.88, streakBonus: 40 };
        case "PLATINUM":
            return { absentProb: 0.08, onTimeProb: 0.85, safetyProb: 0.93, streakBonus: 60 };
        case "DIAMOND":
            return { absentProb: 0.05, onTimeProb: 0.92, safetyProb: 0.96, streakBonus: 80 };
        default:
            return { absentProb: 0.15, onTimeProb: 0.70, safetyProb: 0.80, streakBonus: 30 };
    }
}

/**
 * Controlled “policy edge cases” (still ladder-like):
 * - A few GOLD/PLATINUM with low onTime
 * - A few GOLD with low safety
 * This helps you confirm locked reasons at higher tiers too.
 */
function applyEdgeCaseOverrides(i, tier, base) {
    // pick a few indexes for late/unsafe
    const lateIdx = new Set([12, 13, 27, 28]);     // controlled
    const unsafeIdx = new Set([18, 19, 33]);       // controlled

    const out = { ...base };

    if (lateIdx.has(i) && (tier === "GOLD" || tier === "PLATINUM")) {
        out.onTimeProb = Math.min(out.onTimeProb, 0.45);
    }
    if (unsafeIdx.has(i) && tier === "GOLD") {
        out.safetyProb = Math.min(out.safetyProb, 0.55);
    }
    return out;
}

async function main() {
    const uri = process.env.MONGO_URI || process.env.MONGO_URL;
    if (!uri) throw new Error("Missing MONGO_URI (or MONGO_URL) in env");

    await mongoose.connect(uri);
    console.log("[seedLadderWorkers50] Connected");

    // Delete previous ladder set range (9000002000–2049)
    const old = await VendorUsers.find({
        mobile: { $regex: /^90000020\d{2}$/ },
    }).select("_id mobile").lean();

    const oldIds = old.map((x) => x._id);
    if (oldIds.length) {
        await WorkerWorkDay.deleteMany({ workerId: { $in: oldIds } });
        await WorkerCareerProfile.deleteMany({ workerId: { $in: oldIds } });
        await VendorUsers.deleteMany({ _id: { $in: oldIds } });
        console.log(`[seedLadderWorkers50] Deleted old ladder users: ${oldIds.length}`);
    }

    const tierPlan = [
        { tier: "BRONZE", count: 16, wage: 550 },
        { tier: "SILVER", count: 12, wage: 650 },
        { tier: "GOLD", count: 10, wage: 750 },
        { tier: "PLATINUM", count: 7, wage: 900 },
        { tier: "DIAMOND", count: 5, wage: 1100 },
    ];

    const created = [];
    let globalIndex = 0;

    for (const g of tierPlan) {
        for (let j = 0; j < g.count; j++) {
            const mobile = uniqueMobile(globalIndex);
            const fullName = `${g.tier} Worker ${j + 1}`;

            const skills = skillsForTier(g.tier);

            const worker = await VendorUsers.create({
                mobile,
                username: mobile,
                fullName,
                role: "WORKER",
                department: "LABOUR",
                approvalStatus: "APPROVED",
                onboardingStep: "DONE",
                payrollEnabled: true,
                skills,
                payroll: {
                    salaryType: "DAILY",
                    perDayRate: g.wage,
                    shiftStart: "09:30",
                    shiftEnd: "18:30",
                    graceMinsLate: 10,
                    minHalfDayMins: 240,
                    minFullDayMins: 480,
                },
            });

            await WorkerCareerProfile.create({
                workerId: worker._id,
                currentTier: g.tier,
            });

            created.push({ _id: worker._id, mobile, tier: g.tier, wage: g.wage });
            globalIndex++;
        }
    }

    // Seed last 30 days of locked workdays
    const today = new Date();
    const start = addDays(today, -30);

    for (let i = 0; i < created.length; i++) {
        const w = created[i];
        let perf = perfForTier(w.tier);
        perf = applyEdgeCaseOverrides(i, w.tier, perf);

        let streak = 0;

        for (let d = 0; d <= 30; d++) {
            const date = addDays(start, d);
            const dateKey = istDateKey(date);

            const isAbsent = rand() < perf.absentProb;
            const actualOutcome = isAbsent ? "ABSENT" : "A_FULL";

            const onTime = !isAbsent && rand() < perf.onTimeProb;
            const safetyCompliant = !isAbsent && rand() < perf.safetyProb;

            if (!isAbsent) streak += 1;
            else streak = 0;

            const dayWage = isAbsent ? 0 : w.wage;
            const onTimeBonus = !isAbsent && onTime ? 50 : 0;
            const safetyBonus = !isAbsent && safetyCompliant ? 50 : 0;

            // “attendance bonus” simulation: streak>=6 gives extra
            const streakBonus = !isAbsent && streak >= 6 ? perf.streakBonus : 0;

            const dayBonus = onTimeBonus + safetyBonus + streakBonus;
            const dayTotal = dayWage + dayBonus;

            await WorkerWorkDay.updateOne(
                { workerId: w._id, dateKey },
                {
                    $setOnInsert: {
                        workerId: w._id,
                        dateKey,
                        expectedShift: "C",
                    },
                    $set: {
                        locked: true,
                        actualOutcome,
                        onTime,
                        safetyCompliant,
                        dayWage,
                        dayBonus,
                        dayTotal,
                    },
                },
                { upsert: true }
            );
        }
    }

    console.log("\n[seedLadderWorkers50] Created ladder workers:");
    created.forEach((w) => console.log(`- ${w.mobile} | ${w.tier} | wage=${w.wage}`));

    await mongoose.disconnect();
    console.log("[seedLadderWorkers50] Done");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
