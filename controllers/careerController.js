import WorkerCareerProfile from "../models/WorkerCareerProfile.js";
import WorkerTierHistory from "../models/WorkerTierHistory.js";

/**
 * GET /api/career/:workerId/profile
 */
export const getCareerProfile = async (req, res) => {
    try {
        const { workerId } = req.params;

        let profile = await WorkerCareerProfile.findOne({ workerId });

        // Auto-create baseline profile if missing
        if (!profile) {
            profile = await WorkerCareerProfile.create({
                workerId,
                currentTier: "BRONZE",
                probation: { isOnProbation: false }
            });
        }

        return res.json({ profile });
    } catch (err) {
        console.error("getCareerProfile error:", err);
        res.status(500).json({ error: "Failed to fetch career profile" });
    }
};

/**
 * GET /api/career/:workerId/history?from=&to=
 */
export const getCareerHistory = async (req, res) => {
    try {
        const { workerId } = req.params;
        const { from, to } = req.query;

        const query = { workerId };

        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }

        const history = await WorkerTierHistory.find(query)
            .sort({ createdAt: -1 })
            .limit(200);

        return res.json({ history });
    } catch (err) {
        console.error("getCareerHistory error:", err);
        res.status(500).json({ error: "Failed to fetch career history" });
    }
};

/**
 * GET /api/career/:workerId/rewards
 * Returns pending/applied rewards stored in WorkerCareerProfile.rewards[]
 */
export const getCareerRewards = async (req, res) => {
    try {
        const { workerId } = req.params;

        let profile = await WorkerCareerProfile.findOne({ workerId });

        // Auto-create baseline profile if missing
        if (!profile) {
            profile = await WorkerCareerProfile.create({
                workerId,
                currentTier: "BRONZE",
                probation: { isOnProbation: false },
                rewards: [],
            });
        }

        return res.json({ rewards: profile.rewards || [] });
    } catch (err) {
        console.error("getCareerRewards error:", err);
        res.status(500).json({ error: "Failed to fetch career rewards" });
    }
};
