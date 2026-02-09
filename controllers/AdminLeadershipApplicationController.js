// controllers/AdminLeadershipApplicationController.js
import LeadershipApplication from "../models/LeadershipApplication.js";
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";
import LeadershipTeamMember from "../models/LeadershipTeamMember.js";

export async function adminListApplications(req, res) {
    try {
        const { programId, status } = req.query;

        const q = {};
        if (programId) q.programId = programId;
        if (status) q.status = String(status).toUpperCase();

        const apps = await LeadershipApplication.find(q)
            .populate("workerId", "username fullName mobile role skills")
            .populate("memberWorkerIds", "username fullName mobile role skills")
            .populate("programId", "title stage difficulty status teamRules rewardPolicy siteLabel startAt dueAt")
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, applications: apps });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to list applications" });
    }
}

export async function adminGetApplicationById(req, res) {
    try {
        const { applicationId } = req.params;

        const app = await LeadershipApplication.findById(applicationId)
            .populate("workerId", "username fullName mobile role skills")
            .populate("memberWorkerIds", "username fullName mobile role skills")
            .populate("programId", "title description stage difficulty status teamRules rewardPolicy siteLabel startAt dueAt")
            .lean();

        if (!app) return res.status(404).json({ success: false, message: "Application not found" });

        return res.json({ success: true, application: app });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to load application" });
    }
}

export async function adminApproveApplication(req, res) {
    try {
        const { applicationId } = req.params;
        const { adminNote } = req.body || {};

        const app = await LeadershipApplication.findById(applicationId);
        if (!app) return res.status(404).json({ success: false, message: "Application not found" });

        if (app.status !== "APPLIED") {
            return res.status(400).json({
                success: false,
                message: `Only APPLIED applications can be approved (current: ${app.status})`,
            });
        }

        const program = await LeadershipProgram.findById(app.programId).lean();
        if (!program) return res.status(404).json({ success: false, message: "Program not found" });

        // 1) Mark application selected
        app.status = "SELECTED";
        app.adminNote = adminNote || "";
        app.decidedAt = new Date();
        await app.save();

        // 2) Create leader assignment (idempotent)
        const existingAssign = await LeadershipAssignment.findOne({ programId: app.programId });
        if (!existingAssign) {
            await LeadershipAssignment.create({
                programId: app.programId,
                leaderId: app.workerId,
                selectedBy: "ADMIN",
                selectionBreakdown: { source: "ADMIN_APPROVAL", applicationId: String(app._id) },
            });
        }

        // 3) Create team member rows (idempotent)
        await LeadershipTeamMember.updateOne(
            { programId: app.programId, workerId: app.workerId },
            {
                $setOnInsert: {
                    programId: app.programId,
                    workerId: app.workerId,
                    role: "LEADER",
                    status: "ACCEPTED",
                    invitedBy: app.workerId,
                },
            },
            { upsert: true }
        );

        const memberIds = Array.isArray(app.memberWorkerIds) ? app.memberWorkerIds : [];
        for (const wid of memberIds) {
            await LeadershipTeamMember.updateOne(
                { programId: app.programId, workerId: wid },
                {
                    $setOnInsert: {
                        programId: app.programId,
                        workerId: wid,
                        role: "MEMBER",
                        status: "INVITED",
                        invitedBy: app.workerId,
                    },
                },
                { upsert: true }
            );
        }

        // 4) Move program to TEAM_FORMATION
        const st = String(program.status || "").toUpperCase();
        if (st === "PUBLISHED" || st === "LEADER_SELECTED") {
            await LeadershipProgram.updateOne(
                { _id: app.programId },
                { $set: { status: "TEAM_FORMATION" } }
            );
        }

        return res.json({ success: true, message: "Application approved", applicationId: app._id });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to approve application" });
    }
}

export async function adminRejectApplication(req, res) {
    try {
        const { applicationId } = req.params;
        const { rejectionReason, adminNote } = req.body || {};

        const app = await LeadershipApplication.findById(applicationId);
        if (!app) return res.status(404).json({ success: false, message: "Application not found" });

        if (app.status !== "APPLIED") {
            return res.status(400).json({
                success: false,
                message: `Only APPLIED applications can be rejected (current: ${app.status})`,
            });
        }

        app.status = "REJECTED";
        app.rejectionReason = rejectionReason || "";
        app.adminNote = adminNote || "";
        app.decidedAt = new Date();
        await app.save();

        return res.json({ success: true, message: "Application rejected", applicationId: app._id });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to reject application" });
    }
}
