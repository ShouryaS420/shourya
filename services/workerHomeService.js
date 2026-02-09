// services/workerHomeService.js
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import WorkerWeeklySettlement from "../models/WorkerWeeklySettlement.js";
import WorkerTierHistory from "../models/WorkerTierHistory.js";
import LeadershipSubmission from "../models/LeadershipSubmission.js";
import LeadershipPolicyConfig from "../models/LeadershipPolicyConfig.js";

import { getCurrentWeekRangeKeys, getPreviousWeekRange } from "../utils/weekUtils.js";

/**
 * 1) Today summary + streak + worked days this week
 */
export async function computeTodaySummary(workerId) {
    const todayKey = new Date().toISOString().slice(0, 10);

    const today = await WorkerWorkDay.findOne({
        workerId,
        dateKey: todayKey,
    }).lean();

    let status = "NO_RECORD";
    if (today) {
        status = today.actualOutcome === "ABSENT" ? "ABSENT" : "WORKED";
    }

    // Current week range
    const { startKey, endKey } = getCurrentWeekRangeKeys(new Date());

    const weekDays = await WorkerWorkDay.find({
        workerId,
        dateKey: { $gte: startKey, $lte: endKey },
    }).lean();

    let workedDaysThisWeek = 0;
    for (const d of weekDays) {
        if (d.actualOutcome !== "ABSENT") workedDaysThisWeek++;
    }

    // Streak: count continuous non-ABSENT days backwards
    const last7Days = await WorkerWorkDay.find({
        workerId,
    })
        .sort({ dateKey: -1 })
        .limit(7)
        .lean();

    let streak = 0;
    for (const d of last7Days) {
        if (d.actualOutcome === "ABSENT") break;
        streak++;
    }

    return {
        status,                 // WORKED | ABSENT | NO_RECORD
        earning: 0,             // you already compute earnings elsewhere
        workedDaysThisWeek,
        streak,
    };
}

/**
 * 2) Tier summary
 */
export async function computeTierSummary(workerId) {
    const latest = await WorkerTierHistory.findOne({ workerId })
        .sort({ createdAt: -1 })
        .lean();

    if (!latest) {
        return { code: "BRONZE", score: 0 };
    }

    return {
        code: latest.newTier || latest.tier || "BRONZE",
        score: latest.score || 0,
    };
}

/**
 * 3) Weekly payout status (using your real settlement model)
 */
export async function computePayoutStatus(workerId) {
    const { start } = getPreviousWeekRange(new Date());

    const settlement = await WorkerWeeklySettlement.findOne({
        workerId,
        weekStart: start,
    }).lean();

    if (!settlement) {
        return {
            due: false,
            amount: 0,
            cycle: "WEEKLY",
        };
    }

    const state = settlement.status?.state || settlement.status || "UNPAID";
    const due = state === "UNPAID" || state === "FINAL";

    return {
        due,
        amount: settlement.netPay || 0,
        cycle: "WEEKLY",
    };
}

/**
 * 4) Safety score (derived from WorkerWorkDay, last 7 days)
 */
export async function computeSafetyScore(workerId) {
    const last7Days = await WorkerWorkDay.find({ workerId })
        .sort({ dateKey: -1 })
        .limit(7)
        .lean();

    let score = 100;

    for (const d of last7Days) {
        if (d.actualOutcome === "ABSENT") score -= 10;
        else if (d.actualOutcome === "SUBSHIFT") score -= 5;
    }

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    let riskLevel = "LOW";
    if (score < 50) riskLevel = "HIGH";
    else if (score < 80) riskLevel = "MEDIUM";

    return {
        score,
        riskLevel,
    };
}

/**
 * 5) Leadership status
 */
export async function computeLeadershipStatus(workerId) {
    // Latest submission
    const submission = await LeadershipSubmission.findOne({ workerId })
        .sort({ createdAt: -1 })
        .lean();

    let hasPendingApplication = false;
    let isLeader = false;

    if (submission) {
        if (submission.status === "PENDING") hasPendingApplication = true;
        if (submission.status === "APPROVED") isLeader = true;
    }

    // Eligibility from policy (simple version)
    const policy = await LeadershipPolicyConfig.findOne({ active: true }).lean();

    let eligible = false;
    if (policy) {
        // Example rule: minTier required
        // You can refine later
        eligible = true;
    }

    return {
        eligible,
        hasPendingApplication,
        isLeader,
    };
}

/**
 * 6) Referral status (placeholder v1)
 */
export async function computeReferralStatus(workerId) {
    // No referral system yet
    return {
        eligible: true,
        used: false,
        invitesLeft: 0,
    };
}
