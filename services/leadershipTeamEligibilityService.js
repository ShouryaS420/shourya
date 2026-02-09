// services/leadershipTeamEligibilityService.js
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";
import LeadershipProgram from "../models/LeadershipProgram.js";
// import VendorUser from "../models/VendorUser.js";
import { evaluateLeadershipEligibility } from "./leadershipEligibilityService.js";
import VendorUsers from "../models/VendorUsers.js";

export async function getEligibleTeamCandidates({ programId, leaderId }) {
    const program = await LeadershipProgram.findById(programId).lean();
    if (!program) throw new Error("Program not found");

    const existing = await LeadershipTeamMember.find({ programId }).lean();
    const excludedWorkerIds = new Set(existing.map((m) => String(m.workerId)));
    excludedWorkerIds.add(String(leaderId));

    const workers = await VendorUsers.find({
        isActive: true,
        _id: { $nin: Array.from(excludedWorkerIds) },
    }).lean();

    const eligible = [];

    for (const w of workers) {
        const requiredSkills = program.requiredSkills || [];
        const workerSkills = w.skills || [];
        const missing = requiredSkills.filter((s) => !workerSkills.includes(s));
        if (missing.length > 0) continue;

        const evalRes = await evaluateLeadershipEligibility({ worker: w, program });
        if (!evalRes.eligible) continue;

        const displayName =
            w?.profile?.fullName ||
            w?.fullName ||
            w?.username ||
            (w?.mobile ? `+91 ${w.mobile}` : "Worker");

        eligible.push({
            _id: w._id,
            fullName: displayName,
            mobile: w.mobile || "",
            skills: w.skills || [],
            snapshot: evalRes.snapshot,
        });
    }

    return eligible;
}
