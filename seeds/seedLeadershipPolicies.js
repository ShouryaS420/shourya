// seeds/seedLeadershipPolicies.js
import LeadershipPolicyConfig from "../models/LeadershipPolicyConfig.js";

const POLICIES = [
    // ================= SHUTTERING =================
    { stage: "SHUTTERING", difficulty: "EASY", minTier: "SILVER", minAttendancePct30d: 70, minOnTimePct30d: 55, minSafetyPct30d: 70 },
    { stage: "SHUTTERING", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "SHUTTERING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },
    { stage: "SHUTTERING", difficulty: "CRITICAL", minTier: "PLATINUM", minAttendancePct30d: 90, minOnTimePct30d: 80, minSafetyPct30d: 90 },

    // ================= BAR BENDING =================
    { stage: "BAR_BENDING", difficulty: "EASY", minTier: "SILVER", minAttendancePct30d: 70, minOnTimePct30d: 55, minSafetyPct30d: 70 },
    { stage: "BAR_BENDING", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "BAR_BENDING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },
    { stage: "BAR_BENDING", difficulty: "CRITICAL", minTier: "PLATINUM", minAttendancePct30d: 90, minOnTimePct30d: 80, minSafetyPct30d: 90 },

    // ================= SLAB CASTING =================
    { stage: "SLAB_CASTING", difficulty: "EASY", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "SLAB_CASTING", difficulty: "STANDARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },
    { stage: "SLAB_CASTING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 85, minOnTimePct30d: 75, minSafetyPct30d: 85 },
    { stage: "SLAB_CASTING", difficulty: "CRITICAL", minTier: "PLATINUM", minAttendancePct30d: 90, minOnTimePct30d: 85, minSafetyPct30d: 90 },

    // ================= CURING =================
    { stage: "CURING", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "CURING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },

    // ================= DESHUTTERING =================
    { stage: "DESHUTTERING", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "DESHUTTERING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },
    { stage: "DESHUTTERING", difficulty: "CRITICAL", minTier: "PLATINUM", minAttendancePct30d: 90, minOnTimePct30d: 80, minSafetyPct30d: 90 },

    // ================= MASONRY =================
    { stage: "MASONRY", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "MASONRY", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },

    // ================= PLASTERING =================
    { stage: "PLASTERING", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "PLASTERING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },

    // ================= FINISHING =================
    { stage: "FINISHING", difficulty: "STANDARD", minTier: "SILVER", minAttendancePct30d: 75, minOnTimePct30d: 60, minSafetyPct30d: 75 },
    { stage: "FINISHING", difficulty: "HARD", minTier: "GOLD", minAttendancePct30d: 80, minOnTimePct30d: 70, minSafetyPct30d: 80 },
];

export async function seedLeadershipPolicies() {
    for (const p of POLICIES) {
        await LeadershipPolicyConfig.updateOne(
            { stage: p.stage, difficulty: p.difficulty },
            { $setOnInsert: p },
            { upsert: true }
        );
    }
    console.log("[SEED] Leadership policies ensured");
}
