// services/leadershipAutoSelectionService.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import { selectLeaderForProgramInternal } from "./leadershipAutoSelectionWorker.js";

export async function runAutoLeaderSelection() {
    const candidates = await LeadershipProgram.find({
        status: "PUBLISHED",
        applicationCloseAt: { $ne: null, $lte: new Date() },
    }).lean();

    for (const p of candidates) {
        try {
            // Mark running to prevent double execution
            await LeadershipProgram.updateOne(
                { _id: p._id, status: "PUBLISHED" },
                { $set: { status: "LEADER_SELECTION_RUNNING" } }
            );

            await selectLeaderForProgramInternal(p._id);
        } catch (e) {
            console.error("[AUTO-LEADER-SELECT] failed for", p._id, e);
        }
    }
}
