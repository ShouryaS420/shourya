// controllers/VendorLeadershipApplyController.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipApplication from "../models/LeadershipApplication.js";
import WorkerCareerProfile from "../models/WorkerCareerProfile.js";
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";

/**
 * POST /api/vendor/leadership/apply
 * Body: { programId, preferredTeamSize, memberWorkerIds[] }
 */
export async function applyForLeadershipProgram(req, res) {
    try {
        const worker = req.vendor;
        const { programId, preferredTeamSize, memberWorkerIds } = req.body || {};

        if (!programId) {
            return res.status(400).json({ success: false, message: "programId is required" });
        }

        const program = await LeadershipProgram.findById(programId).lean();
        if (!program || String(program.status || "").toUpperCase() !== "PUBLISHED") {
            return res.status(404).json({ success: false, message: "Leadership program not available" });
        }

        const existing = await LeadershipApplication.findOne({ programId, workerId: worker._id });
        if (existing) {
            return res.status(400).json({ success: false, message: "Already applied for this program" });
        }

        const career = await WorkerCareerProfile.findOne({ workerId: worker._id }).lean();
        const currentTier = career?.currentTier;
        if (!currentTier) {
            return res.status(400).json({ success: false, message: "Career profile not found" });
        }

        if (program.requiredTier) {
            const ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
            if (ORDER.indexOf(currentTier) < ORDER.indexOf(program.requiredTier)) {
                return res.status(403).json({ success: false, message: `Minimum tier required: ${program.requiredTier}` });
            }
        }

        const min = program.teamRules?.teamSizeMin ?? 3;
        const max = program.teamRules?.teamSizeMax ?? 6;

        const teamSize = preferredTeamSize != null ? Number(preferredTeamSize) : null;
        const members = Array.isArray(memberWorkerIds) ? memberWorkerIds : [];

        if (teamSize != null) {
            if (Number.isNaN(teamSize) || teamSize < min || teamSize > max) {
                return res.status(400).json({ success: false, message: `preferredTeamSize must be between ${min} and ${max}` });
            }
            const requiredMembers = Math.max(0, teamSize - 1);
            if (members.length !== requiredMembers) {
                return res.status(400).json({ success: false, message: `Select exactly ${requiredMembers} members for team size ${teamSize}` });
            }
        }

        const normalizedMembers = members.map(String).filter((id) => id && id !== String(worker._id));
        const uniqueMembers = Array.from(new Set(normalizedMembers));

        const app = await LeadershipApplication.create({
            programId,
            workerId: worker._id,
            status: "APPLIED",
            preferredTeamSize: teamSize,
            memberWorkerIds: uniqueMembers,
        });

        return res.json({ success: true, application: app });
    } catch (e) {
        console.error("[LEADERSHIP APPLY ERROR]", e);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/**
 * GET /api/vendor/leadership/my-applications
 */
export async function getMyLeadershipApplications(req, res) {
    try {
        const worker = req.vendor;

        const asLeader = await LeadershipApplication.find({ workerId: worker._id })
            .populate("programId", "title stage difficulty status teamRules rewardPolicy siteLabel startAt dueAt")
            .sort({ createdAt: -1 })
            .lean();

        const memberships = await LeadershipTeamMember.find({ workerId: worker._id })
            .populate("programId", "title stage difficulty status teamRules rewardPolicy siteLabel startAt dueAt")
            .sort({ createdAt: -1 })
            .lean();

        const programIds = Array.from(new Set(memberships.map((m) => String(m.programId?._id || m.programId))));
        const assignments = await LeadershipAssignment.find({ programId: { $in: programIds } }).lean();
        const byProgram = new Map(assignments.map((a) => [String(a.programId), a]));

        const asMember = memberships.map((m) => ({
            ...m,
            assignmentId: byProgram.get(String(m.programId?._id || m.programId)) || null,
        }));

        return res.json({ success: true, asLeader, asMember });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to load applications" });
    }
}
