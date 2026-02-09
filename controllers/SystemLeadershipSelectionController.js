// controllers/SystemLeadershipSelectionController.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipApplication from "../models/LeadershipApplication.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import { computeLeadershipRankingScore } from "../services/leadershipRankingService.js";

export async function selectLeaderForProgram(req, res) {
    const { programId } = req.body;

    if (!programId) {
        return res.status(400).json({ success: false, message: "programId required" });
    }

    const program = await LeadershipProgram.findById(programId);
    if (!program) {
        return res.status(404).json({ success: false, message: "Program not found" });
    }

    // Prevent double selection
    const existing = await LeadershipAssignment.findOne({ programId });
    if (existing) {
        return res.status(400).json({
            success: false,
            message: "Leader already selected for this program",
        });
    }

    const applications = await LeadershipApplication.find({
        programId,
        status: "APPLIED",
    });

    if (applications.length === 0) {
        return res.status(400).json({
            success: false,
            message: "No applications to select from",
        });
    }

    // Compute scores
    const ranked = [];
    for (const app of applications) {
        const r = await computeLeadershipRankingScore(app);
        ranked.push({
            application: app,
            score: r.score,
            breakdown: r.breakdown,
        });
    }

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    const winner = ranked[0];

    // Save assignment
    const assignment = await LeadershipAssignment.create({
        programId,
        leaderId: winner.application.workerId,
        selectionBreakdown: {
            score: winner.score,
            breakdown: winner.breakdown,
            totalApplicants: ranked.length,
        },
    });

    // Update applications
    for (let i = 0; i < ranked.length; i++) {
        const item = ranked[i];
        if (item.application._id.equals(winner.application._id)) {
            item.application.status = "SELECTED";
            item.application.rankingScore = item.score;
        } else {
            item.application.status = "REJECTED";
            item.application.rankingScore = item.score;
            item.application.rejectionReason = "Lower ranking score";
        }
        await item.application.save();
    }

    // Update program status (optional but recommended)
    program.status = "LEADER_SELECTED";
    await program.save();

    return res.json({
        success: true,
        leaderId: assignment.leaderId,
        ranking: ranked.map((r) => ({
            workerId: r.application.workerId,
            score: r.score,
            status:
                r.application._id.equals(winner.application._id)
                    ? "SELECTED"
                    : "REJECTED",
        })),
    });
}
