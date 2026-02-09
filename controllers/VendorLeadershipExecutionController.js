import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import LeadershipSubmission from "../models/LeadershipSubmission.js";

export async function leaderSubmitCompletion(req, res) {
    const leader = req.vendor;
    const { programId, checklist, notes, evidence } = req.body;

    if (!programId) return res.status(400).json({ success: false, message: "programId required" });

    const program = await LeadershipProgram.findById(programId);
    if (!program) return res.status(404).json({ success: false, message: "Program not found" });

    // Ensure this user is the leader
    const asg = await LeadershipAssignment.findOne({ programId, leaderId: leader._id });
    if (!asg) return res.status(403).json({ success: false, message: "Not the leader for this program" });

    if (!["IN_PROGRESS", "TEAM_FORMATION", "LEADER_SELECTED"].includes(program.status)) {
        return res.status(400).json({ success: false, message: `Program not submittable in ${program.status}` });
    }

    const doc = await LeadershipSubmission.findOneAndUpdate(
        { programId },
        {
            $set: {
                programId,
                leaderId: leader._id,
                checklist: checklist || {},
                notes: notes || "",
                evidence: evidence || {},
                submittedAt: new Date(),
            },
        },
        { upsert: true, new: true }
    );

    program.status = "SUBMITTED";
    await program.save();

    return res.json({ success: true, submission: doc });
}
