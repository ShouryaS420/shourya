// cron/leadershipLifecycleCron.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";
import { runAutoLeaderSelection } from "../services/leadershipAutoSelectionService.js";

// Main cron runner
export async function runLeadershipLifecycleCron() {
    try {
        // 1) Auto leader selection (PUBLISHED -> LEADER_SELECTION_RUNNING -> TEAM_FORMATION)
        await runAutoLeaderSelection();

        // 2) Auto move to IN_PROGRESS when team min accepted reached
        await autoMoveToInProgress();

        // 3) Auto expire programs by time rules
        await autoExpirePrograms();
    } catch (e) {
        console.error("[LEADERSHIP-CRON] error", e);
    }
}

async function autoMoveToInProgress() {
    const programs = await LeadershipProgram.find({
        status: "TEAM_FORMATION",
    }).lean();

    for (const p of programs) {
        const accepted = await LeadershipTeamMember.countDocuments({
            programId: p._id,
            status: "ACCEPTED",
        });

        const min = p.teamRules?.teamSizeMin || 3;

        if (accepted >= min) {
            await LeadershipProgram.updateOne(
                { _id: p._id, status: "TEAM_FORMATION" },
                { $set: { status: "IN_PROGRESS" } }
            );
            console.log("[LEADERSHIP] Program moved to IN_PROGRESS:", p._id);
        }
    }
}

async function autoExpirePrograms() {
    const now = new Date();

    // Case 1: Team formation expired
    const tfExpired = await LeadershipProgram.find({
        status: "TEAM_FORMATION",
        teamFormationCloseAt: { $ne: null, $lte: now },
    }).lean();

    for (const p of tfExpired) {
        await LeadershipProgram.updateOne(
            { _id: p._id, status: "TEAM_FORMATION" },
            { $set: { status: "FAILED" } }
        );
        console.log("[LEADERSHIP] Team formation expired:", p._id);
    }

    // Case 2: In-progress expired (not submitted)
    const inProgExpired = await LeadershipProgram.find({
        status: "IN_PROGRESS",
        dueAt: { $ne: null, $lte: now },
    }).lean();

    for (const p of inProgExpired) {
        await LeadershipProgram.updateOne(
            { _id: p._id, status: "IN_PROGRESS" },
            { $set: { status: "EXPIRED" } }
        );
        console.log("[LEADERSHIP] Program expired:", p._id);
    }
}
