import { buildHomeBanners } from "../services/bannerEngine.js";
import {
    computePayoutStatus,
    computeSafetyScore,
    computeLeadershipStatus,
} from "../services/workerHomeService.js";

export const getHomePersonalization = async (req, res) => {
    try {
        const rawLang = req.headers["x-app-lang"] || "en";
        const lang = String(rawLang).toLowerCase().split("-")[0];

        const workerId = req.user.workerId || req.user._id;

        const ctx = {
            payout: await computePayoutStatus(workerId),
            safety: await computeSafetyScore(workerId),
            leadership: await computeLeadershipStatus(workerId),
        };

        const banners = await buildHomeBanners({
            ctx,
            lang,
            publicBaseUrl: process.env.PUBLIC_ASSET_BASE_URL,
            userId: String(workerId),
        });

        return res.json({ success: true, data: banners });
    } catch (e) {
        console.error("home personalization error", e);
        return res.status(500).json({ success: false });
    }
};
