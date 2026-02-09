// controllers/VendorLeadershipProgramController.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import { evaluateLeadershipEligibility } from "../services/leadershipEligibilityService.js";

export async function vendorListLeadershipPrograms(req, res) {
    const worker = req.vendor; // your middleware sets req.vendor

    const programs = await LeadershipProgram.find({ status: "PUBLISHED" })
        .sort({ createdAt: -1 })
        .lean();

    const enriched = [];
    for (const p of programs) {
        const evalRes = await evaluateLeadershipEligibility({ worker, program: p });

        enriched.push({
            ...p,
            eligibilityResult: {
                eligible: evalRes.eligible,
                reasons: evalRes.reasons,
                snapshot: evalRes.snapshot,
            },
        });
    }

    return res.json({ success: true, programs: enriched });
}

export async function vendorGetLeadershipProgramById(req, res) {
    try {
        const { id } = req.params;
        const program = await LeadershipProgram.findById(id).lean();

        if (!program) {
            return res.status(404).json({ success: false, message: "Program not found" });
        }

        // Keep the eligibility contract same as list endpoint
        const worker = req.user?.worker || req.user; // supports both shapes
        const eligibilityResult = await evaluateLeadershipEligibility({
            worker,
            program,
        });

        console.log(eligibilityResult);

        return res.json({
            success: true,
            program: {
                ...program,
                eligibilityResult,
            },
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ success: false, message: "Failed to load program" });
    }
}

