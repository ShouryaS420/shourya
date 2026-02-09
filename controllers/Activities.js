// server/controllers/Activities.js
import Project from '../models/ProjectDetails.js';

export const getUserRecentActivities = async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);

        const projects = await Project.find({ projectId: userId }).lean();

        // flatten activity logs across all projects
        const all = [];
        for (const p of projects) {
            for (const a of (p.activityLogs || [])) {
                all.push({
                    projectId: p._id,
                    projectCode: p.projectId,
                    ...a,
                    createdAt: a.date || p.updatedAt, // fallback
                });
            }
        }

        // sort desc by createdAt
        all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            items: all.slice(0, limit),
            nextCursor: null, // you can add a cursor later if you want
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Failed to fetch activities' });
    }
};
