import WorkerTierHistory from "../models/WorkerTierHistory.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";

export const TIER_ORDER = [
    "BRONZE",
    "SILVER",
    "GOLD",
    "PLATINUM",
    "DIAMOND"
];

export const PROMOTION_REWARDS = {
    // reward is granted when user PROMOTES into the tier (toTier)
    SILVER: { code: "TIER_PROMOTION_BONUS", amount: 250 },
    GOLD: { code: "TIER_PROMOTION_BONUS", amount: 500 },
    PLATINUM: { code: "TIER_PROMOTION_BONUS", amount: 1000 },
    DIAMOND: { code: "TIER_PROMOTION_BONUS", amount: 2000 },
};

export const getNextTier = (tier) => {
    const idx = TIER_ORDER.indexOf(tier);
    if (idx === -1) return tier;
    if (idx >= TIER_ORDER.length - 1) return tier;
    return TIER_ORDER[idx + 1];
};

export const getPrevTier = (tier) => {
    const idx = TIER_ORDER.indexOf(tier);
    if (idx <= 0) return tier;
    return TIER_ORDER[idx - 1];
};

/**
 * Compute performance metrics for a worker in a date window.
 * This is the ONLY place where we read WorkerWorkDay for career logic.
 */
export const computeMetrics = async (workerId, fromDate, toDate) => {
    const days = await WorkerWorkDay.find({
        workerId,
        dateKey: {
            $gte: fromDate,
            $lte: toDate
        },
        locked: true
    });

    const totalDays = days.length;

    if (totalDays === 0) {
        return {
            daysWorked: 0,
            attendanceRate: 0,
            absenceCount: 0,
            onTimeRate: 0,
            safetyRate: 0,
            avgDailyWage: 0
        };
    }

    let presentCount = 0;
    let absentCount = 0;
    let onTimeCount = 0;
    let safetyOkCount = 0;
    let totalWage = 0;

    for (const d of days) {
        // Attendance
        if (d.actualOutcome === "ABSENT") {
            absentCount++;
        } else {
            presentCount++;
        }

        // On-time
        if (d.onTime === true) {
            onTimeCount++;
        }

        // Safety
        if (d.safetyCompliant === true) {
            safetyOkCount++;
        }

        // Wage
        totalWage += Number(d.dayTotal || 0);
    }

    const attendanceRate = presentCount / totalDays; // 0..1
    const onTimeRate = presentCount > 0 ? onTimeCount / presentCount : 0;
    const safetyRate = presentCount > 0 ? safetyOkCount / presentCount : 0;
    const avgDailyWage = presentCount > 0 ? totalWage / presentCount : 0;

    return {
        daysWorked: presentCount,
        attendanceRate,
        absenceCount: absentCount,
        onTimeRate,
        safetyRate,
        avgDailyWage
    };
};

/**
 * Apply WEEKLY rules.
 * This function decides ONLY:
 * - WARNING
 * - PROBATION_START / CLEAR
 * - DEMOTION
 * It NEVER promotes.
 */
export const applyWeeklyRules = (profile, metrics) => {
    const decisions = [];

    const {
        attendanceRate,
        absenceCount,
        onTimeRate,
        safetyRate
    } = metrics;

    // --- Thresholds (can be tuned later centrally) ---
    const LOW_ATTENDANCE = attendanceRate < 0.75;
    const HIGH_ABSENCE = absenceCount >= 3;
    const LOW_PUNCTUALITY = onTimeRate < 0.7;
    const LOW_SAFETY = safetyRate < 0.7;

    const poorPerformance =
        LOW_ATTENDANCE || HIGH_ABSENCE || LOW_PUNCTUALITY || LOW_SAFETY;

    // Case 1: Already on probation and still poor → DEMOTION
    if (profile.probation?.isOnProbation && poorPerformance) {
        decisions.push({
            type: "DEMOTION",
            reasonCode: "PROBATION_FAILED"
        });

        return decisions;
    }

    // Case 2: Not on probation but poor → PROBATION_START
    if (!profile.probation?.isOnProbation && poorPerformance) {
        decisions.push({
            type: "PROBATION_START",
            reasonCode: "WEEKLY_POOR_PERFORMANCE"
        });

        return decisions;
    }

    // Case 3: On probation and recovered → PROBATION_CLEAR
    if (profile.probation?.isOnProbation && !poorPerformance) {
        decisions.push({
            type: "PROBATION_CLEAR",
            reasonCode: "RECOVERED_PERFORMANCE"
        });

        return decisions;
    }

    // Case 4: Minor issues → WARNING
    const minorIssues =
        attendanceRate < 0.9 || onTimeRate < 0.85 || safetyRate < 0.85;

    if (minorIssues) {
        decisions.push({
            type: "WARNING",
            reasonCode: "MINOR_WEEKLY_ISSUES"
        });
    }

    return decisions;
};

/**
 * Apply MONTHLY rules.
 * This function decides ONLY:
 * - PROMOTION
 * - Severe-case DEMOTION
 */
export const applyMonthlyRules = (profile, metrics) => {
    const decisions = [];

    const {
        attendanceRate,
        absenceCount,
        onTimeRate,
        safetyRate,
        daysWorked
    } = metrics;

    // --- Promotion eligibility thresholds ---
    const PROMO_ATTENDANCE = attendanceRate >= 0.9;
    const PROMO_PUNCTUAL = onTimeRate >= 0.85;
    const PROMO_SAFETY = safetyRate >= 0.9;
    const PROMO_MIN_DAYS = daysWorked >= 20;

    const eligibleForPromotion =
        PROMO_ATTENDANCE &&
        PROMO_PUNCTUAL &&
        PROMO_SAFETY &&
        PROMO_MIN_DAYS &&
        !profile.probation?.isOnProbation;

    if (eligibleForPromotion) {
        decisions.push({
            type: "PROMOTION",
            reasonCode: "CONSISTENT_MONTHLY_PERFORMANCE"
        });

        return decisions;
    }

    // --- Severe demotion path ---
    const severeFailure =
        attendanceRate < 0.6 || absenceCount >= 8 || safetyRate < 0.5;

    if (severeFailure) {
        decisions.push({
            type: "DEMOTION",
            reasonCode: "SEVERE_MONTHLY_FAILURE"
        });
    }

    return decisions;
};

/**
 * Apply weekly decisions to DB:
 * - Updates profile
 * - Appends history events
 */
export const applyWeeklyDecisions = async ({
    workerId,
    profile,
    metrics,
    decisions,
    evaluationPeriod,
    evaluationDate
}) => {
    let updatedProfile = profile;

    for (const d of decisions) {
        if (d.type === "WARNING") {
            updatedProfile.warningCount =
                (updatedProfile.warningCount || 0) + 1;

            await WorkerTierHistory.create({
                workerId,
                type: "WARNING",
                fromTier: profile.currentTier,
                toTier: profile.currentTier,
                evaluationType: "WEEKLY",
                evaluationPeriod,
                metricsSnapshot: metrics,
                reasonCode: d.reasonCode
            });
        }

        if (d.type === "PROBATION_START") {
            updatedProfile.probation = {
                isOnProbation: true,
                since: evaluationDate,
                reason: d.reasonCode
            };

            await WorkerTierHistory.create({
                workerId,
                type: "PROBATION_START",
                fromTier: profile.currentTier,
                toTier: profile.currentTier,
                evaluationType: "WEEKLY",
                evaluationPeriod,
                metricsSnapshot: metrics,
                reasonCode: d.reasonCode
            });
        }

        if (d.type === "PROBATION_CLEAR") {
            updatedProfile.probation = {
                isOnProbation: false
            };

            await WorkerTierHistory.create({
                workerId,
                type: "PROBATION_CLEAR",
                fromTier: profile.currentTier,
                toTier: profile.currentTier,
                evaluationType: "WEEKLY",
                evaluationPeriod,
                metricsSnapshot: metrics,
                reasonCode: d.reasonCode
            });
        }

        if (d.type === "DEMOTION") {
            const prevTier = getPrevTier(profile.currentTier);

            updatedProfile.currentTier = prevTier;
            updatedProfile.probation = {
                isOnProbation: false
            };

            await WorkerTierHistory.create({
                workerId,
                type: "DEMOTION",
                fromTier: profile.currentTier,
                toTier: prevTier,
                evaluationType: "WEEKLY",
                evaluationPeriod,
                metricsSnapshot: metrics,
                reasonCode: d.reasonCode
            });
        }
    }

    updatedProfile.lastWeeklyEvalAt = evaluationDate;

    // Next weekly eval = +7 days
    updatedProfile.nextWeeklyEvalAt = new Date(
        evaluationDate.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    await updatedProfile.save();

    return updatedProfile;
};

export const applyMonthlyDecisions = async ({
    workerId,
    profile,
    metrics,
    decisions,
    evaluationPeriod,
    evaluationDate,
}) => {
    let updatedProfile = profile;

    for (const d of decisions) {
        if (d.type === "PROMOTION") {
            const toTier = getNextTier(profile.currentTier);

            // If already at top, no-op
            if (toTier === profile.currentTier) continue;

            updatedProfile.currentTier = toTier;

            // Promotion clears probation
            updatedProfile.probation = { isOnProbation: false };

            // Reward unlock (pending)
            const rewardCfg = PROMOTION_REWARDS[toTier];
            let rewardPayload = null;

            if (rewardCfg?.amount > 0) {
                rewardPayload = { ...rewardCfg };

                updatedProfile.rewards = updatedProfile.rewards || [];
                updatedProfile.rewards.push({
                    code: rewardCfg.code,
                    amount: rewardCfg.amount,
                    status: "PENDING",
                    meta: { fromTier: profile.currentTier, toTier, evaluationPeriod },
                });
            }

            await WorkerTierHistory.create({
                workerId,
                type: "PROMOTION",
                fromTier: profile.currentTier,
                toTier,
                evaluationType: "MONTHLY",
                evaluationPeriod,
                metricsSnapshot: metrics,
                reasonCode: d.reasonCode,
                reward: rewardPayload,
            });
        }

        if (d.type === "DEMOTION") {
            const toTier = getPrevTier(profile.currentTier);

            if (toTier === profile.currentTier) continue;

            updatedProfile.currentTier = toTier;

            // Demotion clears probation (optional); keeps state simple
            updatedProfile.probation = { isOnProbation: false };

            await WorkerTierHistory.create({
                workerId,
                type: "DEMOTION",
                fromTier: profile.currentTier,
                toTier,
                evaluationType: "MONTHLY",
                evaluationPeriod,
                metricsSnapshot: metrics,
                reasonCode: d.reasonCode,
            });
        }
    }

    updatedProfile.lastMonthlyEvalAt = evaluationDate;

    // Next monthly = +1 month (calendar)
    const next = new Date(evaluationDate);
    next.setMonth(next.getMonth() + 1);
    updatedProfile.nextMonthlyEvalAt = next;

    await updatedProfile.save();
    return updatedProfile;
};
