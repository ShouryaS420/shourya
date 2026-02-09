// services/leadershipRankingService.js
import WorkerCareerProfile from "../models/WorkerCareerProfile.js";

const TIER_SCORE = {
    BRONZE: 10,
    SILVER: 20,
    GOLD: 30,
    PLATINUM: 40,
    DIAMOND: 50,
};

export async function computeLeadershipRankingScore(application) {
    const snapshot = application.eligibilitySnapshot || {};
    const workerMetrics = snapshot.workerMetrics || {};

    const career = await WorkerCareerProfile.findOne({
        workerId: application.workerId,
    }).lean();

    const tier = career?.currentTier || "BRONZE";
    const tierScore = TIER_SCORE[tier] || 10;

    const attendance = workerMetrics.attendancePct30d || 0;
    const onTime = workerMetrics.onTimePct30d || 0;
    const safety = workerMetrics.safetyPct30d || 0;

    // Weighted score (0–100 scale)
    const score =
        (tierScore / 50) * 40 +
        (attendance / 100) * 30 +
        (onTime / 100) * 15 +
        (safety / 100) * 15;

    return {
        score: Math.round(score * 100) / 100,
        breakdown: {
            tier,
            tierScore,
            attendance,
            onTime,
            safety,
            weights: {
                tier: 40,
                attendance: 30,
                onTime: 15,
                safety: 15,
            },
        },
    };
}
