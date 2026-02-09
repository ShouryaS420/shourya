import WorkerCareerProfile from "../models/WorkerCareerProfile.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import WorkerTierHistory from "../models/WorkerTierHistory.js";
import {
    computeMetrics,
    applyWeeklyRules,
    applyWeeklyDecisions,
} from "../services/careerEvaluationService.js";

// ISO week helpers
const toDateKey = (d) => d.toISOString().slice(0, 10);

const getISOWeekYearAndNumber = (date) => {
    // Copy date in UTC
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number (Mon=1..Sun=7)
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { isoYear: d.getUTCFullYear(), isoWeek: weekNo };
};

const getLastCompletedBusinessWeekWindow = (now = new Date()) => {
    // Business week = Monday (start) → Saturday (end)

    const end = new Date(now);

    // Find the most recent Saturday (including today if today is Saturday).
    // JS: 0=Sun, 1=Mon, ..., 6=Sat
    const dow = end.getDay();
    const daysSinceSaturday = (dow - 6 + 7) % 7; // 0 if Saturday, 1 if Sunday, 2 if Monday, ...
    end.setDate(end.getDate() - daysSinceSaturday);
    end.setHours(23, 59, 59, 999); // Saturday end of day

    const start = new Date(end);
    start.setDate(end.getDate() - 5); // Monday (6-day window)
    start.setHours(0, 0, 0, 0);

    // Use ISO week number, but label should align to the week’s start (Monday)
    const { isoYear, isoWeek } = getISOWeekYearAndNumber(start);
    const periodLabel = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;

    return { start, end, periodLabel };
};

/**
 * Run weekly evaluation.
 * Options:
 * - from/to: override date window (YYYY-MM-DD)
 * - dryRun: compute and log decisions, do not write
 */
export const runWeeklyCareerEvaluation = async (opts = {}) => {
    const evaluationDate = opts.evaluationDate ? new Date(opts.evaluationDate) : new Date();

    const window = (opts.from && opts.to)
        ? {
            start: new Date(`${opts.from}T00:00:00`),
            end: new Date(`${opts.to}T23:59:59.999`),
            periodLabel: opts.periodLabel || `${opts.from}_to_${opts.to}`,
        }
        : getLastCompletedBusinessWeekWindow(evaluationDate);

    const { start, end, periodLabel } = window;
    const fromKey = toDateKey(start);
    const toKey = toDateKey(end);

    console.log(`[CAREER][WEEKLY] Window ${fromKey} → ${toKey}, period=${periodLabel}, dryRun=${!!opts.dryRun}`);

    const workerIds = await WorkerWorkDay.distinct("workerId", {
        dateKey: { $gte: fromKey, $lte: toKey },
        locked: true,
    });

    console.log(`[CAREER][WEEKLY] Workers to evaluate: ${workerIds.length}`);

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const workerId of workerIds) {
        try {
            // Idempotency guard: if ANY history exists for this worker+period, skip
            const already = await WorkerTierHistory.exists({
                workerId,
                evaluationType: "WEEKLY",
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
                });
            }

            const metrics = await computeMetrics(workerId, fromKey, toKey);
            const decisions = applyWeeklyRules(profile, metrics);

            if (opts.dryRun) {
                console.log(`[CAREER][WEEKLY][DRY] worker=${workerId} tier=${profile.currentTier}`, {
                    metrics,
                    decisions,
                });
                continue;
            }

            if (decisions.length === 0) {
                profile.lastWeeklyEvalAt = evaluationDate;
                profile.nextWeeklyEvalAt = new Date(evaluationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                await profile.save();
                applied++;
                continue;
            }

            await applyWeeklyDecisions({
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
            console.error(`[CAREER][WEEKLY] Failed for worker=${workerId}`, err);
        }
    }

    console.log(`[CAREER][WEEKLY] Completed period=${periodLabel} applied=${applied} skipped=${skipped} failed=${failed}`);
};
