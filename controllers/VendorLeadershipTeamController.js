// controllers/VendorLeadershipTeamController.js
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";
import LeadershipProgram from "../models/LeadershipProgram.js";
import { getEligibleTeamCandidates } from "../services/leadershipTeamEligibilityService.js";
import LeadershipParticipationPolicy from "../models/LeadershipParticipationPolicy.js";

export async function leaderGetTeamCandidates(req, res) {
    try {
        const leader = req.vendor;
        const { programId } = req.query;

        if (!programId) {
            return res.status(400).json({ success: false, message: "programId required" });
        }

        const program = await LeadershipProgram.findById(programId).lean();
        if (!program) {
            return res.status(404).json({ success: false, message: "Program not found" });
        }

        // Option A: team building happens BEFORE leader assignment exists.
        const st = String(program.status || "").toUpperCase();
        const allowed = ["PUBLISHED", "TEAM_FORMATION"].includes(st);
        if (!allowed) {
            return res.status(400).json({
                success: false,
                message: `Team selection not allowed in status: ${program.status}`,
            });
        }

        const candidates = await getEligibleTeamCandidates({
            programId,
            leaderId: leader._id,
        });

        const filtered = (candidates || []).filter(
            (w) => String(w._id) !== String(leader._id)
        );

        return res.json({ success: true, candidates: filtered });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Failed to fetch candidates" });
    }
}

export async function leaderInviteTeamMember(req, res) {
    const leader = req.vendor;
    const { programId, workerId } = req.body;

    if (!programId || !workerId) {
        return res.status(400).json({
            success: false,
            message: "programId and workerId required",
        });
    }

    // Verify leader
    const assignment = await LeadershipAssignment.findOne({
        programId,
        leaderId: leader._id,
    });

    if (!assignment) {
        return res.status(403).json({
            success: false,
            message: "You are not the leader for this program",
        });
    }

    const program = await LeadershipProgram.findById(programId).lean();
    if (!program) {
        return res.status(404).json({ success: false, message: "Program not found" });
    }

    // Check team size limit
    const existing = await LeadershipTeamMember.find({
        programId,
        status: { $in: ["INVITED", "ACCEPTED"] },
    });

    const max = program.teamRules?.teamSizeMax || 6;
    if (existing.length >= max) {
        return res.status(400).json({
            success: false,
            message: `Team size limit reached (${max})`,
        });
    }



    // Check conflict rules
    const policy = await LeadershipParticipationPolicy.findOne().lean();

    // Find other active programs this worker is in
    const activeMemberships = await LeadershipTeamMember.find({
        workerId,
        status: { $in: ["INVITED", "ACCEPTED"] },
    }).populate("programId", "status startAt dueAt").lean();

    let activeCount = 0;

    for (const m of activeMemberships) {
        const st = m.programId?.status;
        if (["TEAM_FORMATION", "IN_PROGRESS", "SUBMITTED"].includes(st)) {
            activeCount++;
        }
    }

    if (policy.enforceNoOverlap && activeCount >= policy.maxConcurrentPrograms) {
        return res.status(400).json({
            success: false,
            message: "Worker is already active in another leadership program",
        });
    }

    try {
        const member = await LeadershipTeamMember.create({
            programId,
            workerId,
            role: "MEMBER",
            status: "INVITED",
            invitedBy: leader._id,
        });

        return res.json({ success: true, member });
    } catch (e) {
        if (String(e).includes("duplicate key")) {
            return res.status(400).json({
                success: false,
                message: "Worker already added or invited",
            });
        }
        throw e;
    }
}

export async function memberGetMyInvites(req, res) {
    const worker = req.vendor;

    const invites = await LeadershipTeamMember.find({
        workerId: worker._id,
        status: "INVITED",
    })
        .populate("programId", "title stage difficulty siteLabel")
        .lean();

    return res.json({ success: true, invites });
}

export async function memberRespondInvite(req, res) {
    const worker = req.vendor;
    const { teamMemberId, action } = req.body; // action = ACCEPT or DECLINE

    if (!teamMemberId || !["ACCEPT", "DECLINE"].includes(action)) {
        return res.status(400).json({
            success: false,
            message: "teamMemberId and valid action required",
        });
    }

    const member = await LeadershipTeamMember.findOne({
        _id: teamMemberId,
        workerId: worker._id,
        status: "INVITED",
    });

    if (!member) {
        return res.status(404).json({
            success: false,
            message: "Invite not found",
        });
    }

    member.status = action === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    member.respondedAt = new Date();
    await member.save();

    return res.json({ success: true, member });
}
