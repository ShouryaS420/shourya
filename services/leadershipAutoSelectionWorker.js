// services/leadershipAutoSelectionWorker.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import LeadershipApplication from "../models/LeadershipApplication.js";
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";
import { computeLeadershipRankingScore } from "./leadershipRankingService.js";

export async function selectLeaderForProgramInternal(programId) {
    const program = await LeadershipProgram.findById(programId);
    if (!program) return;

    // Safety: do not select twice
    const existing = await LeadershipAssignment.findOne({ programId });
    if (existing) {
        program.status = "TEAM_FORMATION";
        await program.save();
        return;
    }

    const apps = await LeadershipApplication.find({
        programId,
        status: "APPLIED",
    });

    if (apps.length === 0) {
        program.status = "FAILED";
        await program.save();
        return;
    }

    const ranked = [];
    for (const app of apps) {
        const r = await computeLeadershipRankingScore(app);
        ranked.push({ app, score: r.score, breakdown: r.breakdown });
    }

    ranked.sort((a, b) => b.score - a.score);
    const winner = ranked[0];

    // Create assignment
    const asg = await LeadershipAssignment.create({
        programId,
        leaderId: winner.app.workerId,
        selectionBreakdown: {
            score: winner.score,
            breakdown: winner.breakdown,
            totalApplicants: ranked.length,
        },
        selectedBy: "SYSTEM",
    });

    // Create leader team member
    await LeadershipTeamMember.create({
        programId,
        workerId: winner.app.workerId,
        role: "LEADER",
        status: "ACCEPTED",
        invitedBy: winner.app.workerId,
    });

    // Update application statuses
    for (const r of ranked) {
        if (r.app._id.equals(winner.app._id)) {
            r.app.status = "SELECTED";
            r.app.rankingScore = r.score;
        } else {
            r.app.status = "REJECTED";
            r.app.rankingScore = r.score;
            r.app.rejectionReason = "Lower ranking score";
        }
        await r.app.save();
    }

    program.status = "TEAM_FORMATION";
    await program.save();
}
