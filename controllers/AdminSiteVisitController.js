import SiteVisit from "../models/SiteVisit.js";
import mongoose from "mongoose"; // ✨ needed for Types.ObjectId
import User from "../models/User.js";
import Project from "../models/ProjectDetails.js";
import { markSiteVisitProgress, markSiteVisitStep } from "../utils/steps.js";

/**
 * GET /api/admin/site-visits
 * Query:
 *  - status: pending|verifying|completed|all  (default: verifying)
 *  - q: search in user name/email/mobile/bookingRef
 *  - page, limit
 */
export async function listReports(req, res) {
    const {
        status = "verifying",
        q = "",
        page = 1,
        limit = 20,
    } = req.query;

    const L = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
    const P = Math.max(1, parseInt(page, 10) || 1);

    // Status mapping → visits that reached draft/verification stage
    const filter = {};
    if (status !== "all") {
        if (status === "pending") {
            // vendor saved inputs but not yet submitted draft → status 'in_progress' or 'submitted_inputs'
            filter.status = { $in: ["submitted_inputs"] };
        } else if (status === "verifying") {
            filter.status = "verifying";
        } else if (status === "completed") {
            filter.status = "completed";
        }
    }

    // Basic text search
    const qtrim = String(q || "").trim();
    const textOr = [];
    if (qtrim) {
        // We’ll fetch users first and use their ids
        const users = await User.find({
            $or: [
                { username: new RegExp(qtrim, "i") },
                { email: new RegExp(qtrim, "i") },
                { mobile: new RegExp(qtrim.replace(/\D/g, ""), "i") },
                { userId: new RegExp(qtrim, "i") },
                { mainUserID: new RegExp(qtrim, "i") },
            ],
        }).select("_id").lean();

        const userIds = users.map(u => u._id);
        if (userIds.length) textOr.push({ userId: { $in: userIds } });
        // bookingRef on visit
        textOr.push({ bookingRef: new RegExp(qtrim, "i") });
    }
    const query = { ...filter, ...(textOr.length ? { $or: textOr } : {}) };

    const [items, total] = await Promise.all([
        SiteVisit.find(query)
            .sort({ updatedAt: -1 })
            .skip((P - 1) * L)
            .limit(L)
            .lean(),
        SiteVisit.countDocuments(query)
    ]);

    // hydrate: attach user summary + projectId
    const userIds = [...new Set(items.map(v => String(v.userId)))];
    const usersById = Object.fromEntries(
        (await User.find({ _id: { $in: userIds } })
            .select("_id userId username email mobile mainUserID")
            .lean()
        ).map(u => [String(u._id), u])
    );

    // Build ObjectIds safely
    const userObjectIds = userIds
        .filter(Boolean)
        .map(id => {
            try { return new mongoose.Types.ObjectId(id); }
            catch { return null; }
        })
        .filter(Boolean);

    // If your Project schema keeps a ref as `userMongoId: ObjectId`,
    // this will grab the most recent project per user.
    let projectByUserMongo = {};
    if (userObjectIds.length > 0) {
        const projects = await Project.aggregate([
            { $match: { userMongoId: { $in: userObjectIds } } },
            { $sort: { updatedAt: -1 } },
            { $group: { _id: "$userMongoId", projectId: { $first: "$projectId" } } },
        ]);
        projectByUserMongo = Object.fromEntries(
            projects.map(p => [String(p._id), p.projectId])
        );
    }

    const rows = items.map(v => ({
        _id: v._id,
        bookingRef: v.bookingRef,
        status: v.status,
        when: v.when,
        address: v.address,
        user: usersById[String(v.userId)] || null,
        projectId: projectByUserMongo[String(v.userId)] || null,
        hasDraft: !!(v.report && (v.report.summary || v.report.sections?.length || v.report.photos?.length)),
        report: {
            verifiedAt: v?.report?.verifiedAt || null,
            pdfUrl: v?.report?.pdfUrl || null,
        }
    }));

    res.json({
        success: true,
        page: P,
        limit: L,
        total,
        rows
    });
}

/**
 * GET /api/admin/site-visits/:id
 * Returns full visit + user + project for review screen
 */
export async function getReport(req, res) {
    const { id } = req.params;
    const visit = await SiteVisit.findById(id)
        .populate("assignedTo", "username mobile role")
        .lean();
    if (!visit) return res.status(404).json({ success: false, message: "Not found" });

    const user = await User.findById(visit.userId).select("_id userId username email mobile mainUserID").lean();
    const project = await Project.findOne({ userMongoId: visit.userId }).sort({ updatedAt: -1 }).select("projectId").lean();

    res.json({
        success: true,
        visit,
        user,
        projectId: project?.projectId || null,
    });
}

/**
 * POST /api/admin/site-visits/:id/verify
 * Body: { approve: true, pdfUrl? }
 * Marks verified → status completed → update user steps: verification_done, report_shared, completed
 */
export async function verifyReport(req, res) {
    const { id } = req.params;
    const { approve, pdfUrl } = req.body || {};
    if (!approve) return res.status(400).json({ success: false, message: "approve=true required" });

    const visit = await SiteVisit.findById(id);
    if (!visit) return res.status(404).json({ success: false, message: "Not found" });

    // Ensure draft exists
    if (!visit.report || (!visit.report.summary && !Array.isArray(visit.report.sections))) {
        return res.status(400).json({ success: false, message: "No draft report to verify" });
    }

    // Mark verification & completion
    visit.report.verifiedBy = "admin";
    visit.report.verifiedAt = new Date();
    if (pdfUrl) visit.report.pdfUrl = pdfUrl;
    visit.status = "completed";
    await visit.save();

    // Update the user’s step/substeps
    await markSiteVisitProgress(visit.userId, "verification_done");
    await markSiteVisitProgress(visit.userId, "report_shared");
    await markSiteVisitStep(visit.userId, "completed");

    const populated = await SiteVisit.findById(id).populate("assignedTo", "username mobile role");
    res.json({ success: true, visit: populated });
}
