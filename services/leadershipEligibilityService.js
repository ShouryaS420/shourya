// services/leadershipEligibilityService.js
import WorkerCareerProfile from "../models/WorkerCareerProfile.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import LeadershipPolicyConfig from "../models/LeadershipPolicyConfig.js";

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

function tierAtLeast(currentTier, minTier) {
    return TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(minTier);
}

function toDateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export async function evaluateLeadershipEligibility({ worker, program }) {
    const reasons = [];
    const now = new Date();

    // 1) Load system policy
    const policy = await LeadershipPolicyConfig.findOne({
        stage: program.stage,
        difficulty: program.difficulty,
        isActive: true,
    }).lean();

    if (!policy) {
        return {
            eligible: false,
            reasons: ["No system policy configured for this stage & difficulty"],
            snapshot: {},
        };
    }

    // 2) Load career tier
    const career = await WorkerCareerProfile.findOne({ workerId: worker._id }).lean();
    const currentTier = career?.currentTier || "BRONZE";

    if (!tierAtLeast(currentTier, policy.minTier)) {
        reasons.push(`Reach ${policy.minTier} tier`);
    }

    // 3) Skill check
    const requiredSkills = program.requiredSkills || [];
    if (requiredSkills.length > 0) {
        const workerSkills = worker?.skills || [];
        const missing = requiredSkills.filter((s) => !workerSkills.includes(s));
        if (missing.length > 0) reasons.push(`Missing skill(s): ${missing.join(", ")}`);
    }

    // 4) Attendance metrics (30 days)
    const days = 30;
    const from = new Date(now);
    from.setDate(from.getDate() - (days - 1));

    const fromKey = toDateKey(from);
    const toKey = toDateKey(now);

    const workdays = await WorkerWorkDay.find({
        workerId: worker._id,
        dateKey: { $gte: fromKey, $lte: toKey },
        locked: true,
    }).lean();

    const present = workdays.filter((d) => d.actualOutcome !== "ABSENT");
    const presentCount = present.length;

    const onTimeCount = present.filter((d) => d.onTime === true).length;
    const safetyCount = present.filter((d) => d.safetyCompliant === true).length;

    const attendancePct30d = Math.round((presentCount / days) * 100);
    const onTimePct30d = presentCount ? Math.round((onTimeCount / presentCount) * 100) : 0;
    const safetyPct30d = presentCount ? Math.round((safetyCount / presentCount) * 100) : 0;

    if (attendancePct30d < policy.minAttendancePct30d)
        reasons.push(`Attendance below ${policy.minAttendancePct30d}% (30d)`);

    if (onTimePct30d < policy.minOnTimePct30d)
        reasons.push(`On-time below ${policy.minOnTimePct30d}% (30d)`);

    if (safetyPct30d < policy.minSafetyPct30d)
        reasons.push(`Safety below ${policy.minSafetyPct30d}% (30d)`);

    const eligible = reasons.length === 0;

    return {
        eligible,
        reasons,
        snapshot: {
            stage: program.stage,
            difficulty: program.difficulty,
            policyUsed: {
                minTier: policy.minTier,
                minAttendancePct30d: policy.minAttendancePct30d,
                minOnTimePct30d: policy.minOnTimePct30d,
                minSafetyPct30d: policy.minSafetyPct30d,
            },
            workerMetrics: {
                currentTier,
                attendancePct30d,
                onTimePct30d,
                safetyPct30d,
            },
        },
    };
}
