import AppBanner from "../models/AppBanner.js";
import { pickBannerVariant } from "../services/bannerVariantService.js";

export const getWorkerOffersFeed = async (req, res) => {
    try {
        const lang = String(req.headers["x-app-lang"] || "en").toLowerCase();

        // your vendor auth stores user in req.user
        const workerId = req.user?.workerId || req.user?._id;

        // asset base
        const publicBaseUrl = (process.env.PUBLIC_ASSET_BASE_URL || "https://magneticbyte.com")
            .replace(/\/$/, "");

        // pull only OFFERS
        const rows = await AppBanner.find({ active: true, placement: "OFFERS" })
            .sort({ priority: -1, createdAt: -1 })
            .lean();

        const offers = [];
        for (const b of rows) {
            const v = pickBannerVariant({
                userId: String(workerId),
                bannerCode: b.code,
                lang,
                variants: b.variants,
            });

            if (!v?.imagePath) continue;

            offers.push({
                code: b.code,
                imageUrl: `${publicBaseUrl}/${String(v.imagePath).replace(/^\//, "")}`,
                deepLink: b.deepLink || { type: "NAVIGATE", screen: "Offers", params: {} },
            });
        }

        return res.json({ success: true, data: { offers } });
    } catch (e) {
        console.error("getWorkerOffersFeed error", e);
        return res.status(500).json({ success: false, message: "Failed to load offers feed" });
    }
};
