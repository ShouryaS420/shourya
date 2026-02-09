import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";
import LeadershipVerification from "../models/LeadershipVerification.js";
import WorkerWorkDay from "../models/WorkerWorkDay.js";
import WorkerIncentiveEvent from "../models/WorkerIncentiveEvent.js";
import LeadershipParticipationPolicy from "../models/LeadershipParticipationPolicy.js";

function dateKeyFromDate(d) {
    return new Date(d).toISOString().slice(0, 10);
}

export async function adminApproveAndPostPayout(req, res) {
    const { programId } = req.body;
    if (!programId) return res.status(400).json({ ok: false, error: "programId required" });

    const program = await LeadershipProgram.findById(programId);
    if (!program) return res.status(404).json({ ok: false, error: "program_not_found" });

    if (program.status !== "SUPERVISOR_VERIFIED") {
        return res.status(400).json({ ok: false, error: `invalid_state_${program.status}` });
    }

    const ver = await LeadershipVerification.findOne({ programId }).lean();
    if (!ver || ver.decision !== "PASS") {
        return res.status(400).json({ ok: false, error: "not_verified_pass" });
    }

    const assignment = await LeadershipAssignment.findOne({ programId }).lean();
    if (!assignment) return res.status(400).json({ ok: false, error: "leader_not_selected" });

    // Team members who accepted
    const team = await LeadershipTeamMember.find({
        programId,
        status: "ACCEPTED",
    }).lean();

    // Effective date key: use dueAt if present else today
    const effectiveDateKey = program.dueAt ? dateKeyFromDate(program.dueAt) : dateKeyFromDate(new Date());

    // Participation rule v1 (auditable):
    // - Must have at least 1 locked workday between startAt..dueAt (or last 7 days fallback)
    let startKey = effectiveDateKey;
    let endKey = effectiveDateKey;

    if (program.startAt && program.dueAt) {
        startKey = dateKeyFromDate(program.startAt);
        endKey = dateKeyFromDate(program.dueAt);
    }

    const payouts = [];

    for (const m of team) {
        const isLeader = m.role === "LEADER";

        const policy = await LeadershipParticipationPolicy.findOne().lean();

        const days = await WorkerWorkDay.find({
            workerId: m.workerId,
            dateKey: { $gte: startKey, $lte: endKey },
            locked: true,
            actualOutcome: { $ne: "ABSENT" },
        }).lean();

        const participatedDays = days.length;
        const minReq = policy?.minDaysParticipation || 2;

        const participated = participatedDays >= minReq;

        if (!participated) {
            // Skip payout, record audit
            console.log(
                `[LEADERSHIP] Worker ${m.workerId} skipped: only ${participatedDays} days, required ${minReq}`
            );
            continue;
        }

        if (!participated) continue;

        const amount = isLeader ? (program.rewardPolicy?.leaderBonus || 0) : (program.rewardPolicy?.memberBonus || 0);
        if (!amount || amount <= 0) continue;

        const kind = isLeader ? "LEADER_BONUS" : "MEMBER_BONUS";

        const evt = await WorkerIncentiveEvent.updateOne(
            { workerId: m.workerId, source: "LEADERSHIP_PROGRAM", sourceId: program._id, kind },
            {
                $setOnInsert: {
                    workerId: m.workerId,
                    source: "LEADERSHIP_PROGRAM",
                    sourceId: program._id,
                    kind,
                    amount,
                    effectiveDateKey,
                    status: "APPROVED",
                    meta: {
                        programTitle: program.title,
                        stage: program.stage,
                        difficulty: program.difficulty,
                        participation: { startKey, endKey, daysCount: days.length },
                    },
                },
            },
            { upsert: true }
        );

        payouts.push({ workerId: m.workerId, kind, amount });
    }

    program.status = "ADMIN_APPROVED";
    await program.save();

    return res.json({ ok: true, posted: payouts.length, payouts });
}
