import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipSubmission from "../models/LeadershipSubmission.js";
import LeadershipVerification from "../models/LeadershipVerification.js";

export async function supervisorVerifyProgram(req, res) {
    const admin = req.admin; // from requireAdminAuth
    const { programId, decision, remarks, qcScores, evidence, supervisor } = req.body;

    if (!programId || !["PASS", "FAIL"].includes(decision)) {
        return res.status(400).json({ ok: false, error: "programId and decision(PASS/FAIL) required" });
    }

    const program = await LeadershipProgram.findById(programId);
    if (!program) return res.status(404).json({ ok: false, error: "program_not_found" });

    const submission = await LeadershipSubmission.findOne({ programId }).lean();
    if (!submission) return res.status(400).json({ ok: false, error: "no_submission" });

    const ver = await LeadershipVerification.findOneAndUpdate(
        { programId },
        {
            $set: {
                programId,
                decision,
                remarks: remarks || "",
                qcScores: qcScores || {},
                evidence: evidence || {},
                supervisor: {
                    name: supervisor?.name || "",
                    mobile: supervisor?.mobile || "",
                    verifiedByAdminId: admin?.id || null,
                },
                verifiedAt: new Date(),
            },
        },
        { upsert: true, new: true }
    );

    program.status = decision === "PASS" ? "SUPERVISOR_VERIFIED" : "REJECTED";
    await program.save();

    res.json({ ok: true, verification: ver });
}
