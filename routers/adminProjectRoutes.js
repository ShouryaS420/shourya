import express from "express";
import User from "../models/User.js";
import Estimate from "../models/Estimate.js";
import SiteVisit from "../models/SiteVisit.js";
import ProjectDetails from "../models/ProjectDetails.js";
import { adminGetProjectPaymentSchedule, adminUpdateProjectPaymentSchedule } from "../controllers/Estimate.js";

const router = express.Router();

/**
 * ADMIN — FETCH ALL USERS + THEIR PROJECT PIPELINE
 */
router.get("/project-management/users", async (req, res) => {
    try {
        // Fetch ALL users
        const users = await User.find({})
            .select("username email mobile constructionDetails createdAt updatedAt")
            .lean();

        if (!users.length) {
            return res.json({
                success: true,
                users: [],
            });
        }

        // Collect all estimate IDs
        let estimateIds = [];
        users.forEach((u) => {
            (u.constructionDetails || []).forEach((cd) => {
                if (cd.estimateId) estimateIds.push(cd.estimateId);
            });
        });

        estimateIds = [...new Set(estimateIds.map((id) => id.toString()))];

        const estimateMap = {};
        if (estimateIds.length > 0) {
            const estimates = await Estimate.find({
                _id: { $in: estimateIds },
            })
                .select("status humanId assignedRM user createdAt updatedAt")
                .lean();

            estimates.forEach((e) => {
                estimateMap[e._id.toString()] = e;
            });
        }

        const finalUsers = users.map((user) => {
            const cds = (user.constructionDetails || []).map((cd) => {
                const est = cd.estimateId
                    ? estimateMap[cd.estimateId.toString()] || null
                    : null;

                return {
                    estimateId: cd.estimateId || null,
                    estimateHumanId: est?.humanId || cd.estimateHumanId || null,
                    status: est?.status || cd.status || "Pending",
                    assignedRM: est?.assignedRM || null,
                    createdAt: est?.createdAt || user.createdAt || null,
                    updatedAt: est?.updatedAt || user.updatedAt || null,
                };
            });

            return {
                _id: user._id,
                username: user.username,
                email: user.email,
                mobile: user.mobile,
                createdAt: user.createdAt || null,
                updatedAt: user.updatedAt || null,
                constructionDetails: cds,
            };
        });

        res.json({
            success: true,
            users: finalUsers,
        });
    } catch (err) {
        console.error("❌ Admin Project Management API Error:", err);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
});

// ADMIN — FULL CLIENT PROFILE (new users + site visits + estimates + projects + activity)
router.get("/project-management/users/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        // 1) Base user
        const user = await User.findById(userId)
            .select(
                "username email mobile createdAt source platform " +
                "plotInformation constructionDetails"
            )
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const userIdStr = user._id.toString();

        // 2) Site visits for this user
        const siteVisits = await SiteVisit.find({ userId: userIdStr })
            .sort({ createdAt: -1 })
            .select(
                "_id humanId status stage scheduledDate slot city area state pincode " +
                "addressLine createdAt updatedAt"
            )
            .lean();

        // 3) Estimates for this user
        const estimates = await Estimate.find({ user: user._id })
            .sort({ createdAt: -1 })
            .select(
                "_id humanId status packageName totalAmount city area state " +
                "createdAt updatedAt"
            )
            .lean();

        // 4) Projects for this user
        // NOTE: ProjectDetails stores clientId, not user
        const projects = await ProjectDetails.find({ clientId: user._id })
            .sort({ createdAt: -1 })
            .select(
                "_id projectCode projectName projectTitle status city state " +
                "startDate endDate createdAt updatedAt"
            )
            .lean();

        // 6) Some quick derived journey info for the frontend
        const hasSiteVisit = siteVisits.length > 0;
        const hasEstimate = estimates.length > 0;
        const hasProject = projects.length > 0;

        let journeyStage = "New user";
        if (hasProject) {
            const hasCompleted = projects.some(p =>
                String(p.status || "").toLowerCase().includes("complete")
            );
            journeyStage = hasCompleted ? "Completed project" : "Active project";
        } else if (hasEstimate) {
            const hasApproval = estimates.some(e =>
                String(e.status || "").toLowerCase().includes("approv")
            );
            journeyStage = hasApproval ? "Sent for approval / Approved" : "Estimate / Proposal";
        } else if (hasSiteVisit) {
            journeyStage = "Site visit booked";
        }

        res.json({
            success: true,
            user,
            siteVisits,
            estimates,
            projects,
            journey: {
                stage: journeyStage,
                hasSiteVisit,
                hasEstimate,
                hasProject,
                counts: {
                    siteVisits: siteVisits.length,
                    estimates: estimates.length,
                    projects: projects.length,
                },
            },
        });
    } catch (err) {
        console.error("❌ Admin Client Profile API Error:", err);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
});

// GET /api/admin/projects/:projectId/payment-schedule
router.get(
    "/projects/:projectId/payment-schedule",
    // requireCRM,
    adminGetProjectPaymentSchedule
);

// PUT /api/admin/projects/:projectId/payment-schedule
router.put(
    "/projects/:projectId/payment-schedule",
    // requireCRM,
    adminUpdateProjectPaymentSchedule
);

export default router;
