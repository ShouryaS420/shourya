import dayjs from "dayjs";
import WorkerCareerProfile from "../models/WorkerCareerProfile.js";
import WorkerTierHistory from "../models/WorkerTierHistory.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import {
    computeMetrics,
    applyMonthlyRules,
    applyMonthlyDecisions,
} from "../services/careerEvaluationService.js";

const toDateKey = (d) => dayjs(d).format("YYYY-MM-DD");

const getPreviousMonthWindow = (now = new Date()) => {
    const end = dayjs(now).startOf("month").subtract(1, "day").endOf("day"); // last day of prev month
    const start = end.startOf("month").startOf("day");

    const periodLabel = start.format("YYYY-MM"); // e.g. "2026-01"
    return { start: start.toDate(), end: end.toDate(), periodLabel };
};

/**
 * Options:
 * - from/to (YYYY-MM-DD) override
 * - periodLabel override
 * - dryRun: logs only
 */
export const runMonthlyCareerEvaluation = async (opts = {}) => {
    const evaluationDate = opts.evaluationDate ? new Date(opts.evaluationDate) : new Date();

    const window = (opts.from && opts.to)
        ? {
            start: dayjs(opts.from).startOf("day").toDate(),
            end: dayjs(opts.to).endOf("day").toDate(),
            periodLabel: opts.periodLabel || `${opts.from}_to_${opts.to}`,
        }
        : getPreviousMonthWindow(evaluationDate);

    const { start, end, periodLabel } = window;
    const fromKey = toDateKey(start);
    const toKey = toDateKey(end);

    console.log(`[CAREER][MONTHLY] Window ${fromKey} → ${toKey}, period=${periodLabel}, dryRun=${!!opts.dryRun}`);

    // Evaluate workers who have any locked workdays in this month
    const workerIds = await WorkerWorkDay.distinct("workerId", {
        dateKey: { $gte: fromKey, $lte: toKey },
        locked: true,
    });

    console.log(`[CAREER][MONTHLY] Workers to evaluate: ${workerIds.length}`);

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const workerId of workerIds) {
        try {
            // Idempotency: if already evaluated for this month, skip
            const already = await WorkerTierHistory.exists({
                workerId,
                evaluationType: "MONTHLY",
                evaluationPeriod: periodLabel,
            });

            if (already) {
                skipped++;
                continue;
            }

            let profile = await WorkerCareerProfile.findOne({ workerId });
            if (!profile) {
                profile = await WorkerCareerProfile.create({
                    workerId,
                    currentTier: "BRONZE",
                    probation: { isOnProbation: false },
                    rewards: [],
                });
            }

            const metrics = await computeMetrics(workerId, fromKey, toKey);
            const decisions = applyMonthlyRules(profile, metrics);

            if (opts.dryRun) {
                console.log(`[CAREER][MONTHLY][DRY] worker=${workerId} tier=${profile.currentTier}`, {
                    metrics,
                    decisions,
                });
                continue;
            }

            if (decisions.length === 0) {
                profile.lastMonthlyEvalAt = evaluationDate;
                const next = new Date(evaluationDate);
                next.setMonth(next.getMonth() + 1);
                profile.nextMonthlyEvalAt = next;
                await profile.save();
                applied++;
                continue;
            }

            await applyMonthlyDecisions({
                workerId,
                profile,
                metrics,
                decisions,
                evaluationPeriod: periodLabel,
                evaluationDate,
            });

            applied++;
        } catch (err) {
            failed++;
            console.error(`[CAREER][MONTHLY] Failed for worker=${workerId}`, err);
        }
    }

    console.log(`[CAREER][MONTHLY] Completed period=${periodLabel} applied=${applied} skipped=${skipped} failed=${failed}`);
};
