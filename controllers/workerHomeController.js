// controllers/workerHomeController.js
import {
    computeTodaySummary,
    computeTierSummary,
    computePayoutStatus,
    computeSafetyScore,
    computeLeadershipStatus,
    computeReferralStatus,
} from "../services/workerHomeService.js";

import AppBanner from "../models/AppBanner.js";
import { pickVariant } from "../services/bannerVariantService.js";

function inWindow(now, startAt, endAt) {
    if (startAt && now < new Date(startAt)) return false;
    if (endAt && now > new Date(endAt)) return false;
    return true;
}

async function getPromoBannersForWorker({ workerId, lang, ctx, publicBaseUrl }) {
    const now = new Date();

    const rows = await AppBanner.find({ active: true }).sort({ priority: -1 }).lean();

    const out = [];

    for (const b of rows) {
        if (!inWindow(now, b.startAt, b.endAt)) continue;

        const t = b.targeting || {};

        // tier rule
        if (Array.isArray(t.tiers) && t.tiers.length) {
            if (!t.tiers.includes(ctx?.tier?.code)) continue;
        }

        // payout rule
        if (t.payoutDueOnly === true && ctx?.payout?.due !== true) continue;

        // leadership rule
        if (t.leadershipEligibleOnly === true && ctx?.leadership?.eligible !== true) continue;

        // safety rule
        if (typeof t.minSafetyScore === "number" && (ctx?.safety?.score ?? 0) < t.minSafetyScore) continue;

        // streak rule
        if (typeof t.attendanceStreakGte === "number" && (ctx?.today?.streak ?? 0) < t.attendanceStreakGte) continue;

        const variant = pickVariant({
            workerId,
            bannerCode: b.code,
            lang,
            variantsByLang: b.variants || {},
        });

        if (!variant) continue;

        const imageUrl = `${publicBaseUrl.replace(/\/$/, "")}/${String(variant.imagePath).replace(/^\//, "")}`;

        out.push({
            code: b.code,
            priority: b.priority ?? 50,
            renderMode: "IMAGE_ONLY",
            imageUrl,
            deepLink: b.deepLink,
        });
    }

    return out;
}

export const getWorkerHomePersonalization = async (req, res) => {
    try {
        const workerId = req.vendor?._id || req.user?._id;
        // depending on how authWorker sets req

        if (!workerId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Run in parallel (important for performance)
        const [
            today,
            tier,
            payout,
            safety,
            leadership,
            referral,
        ] = await Promise.all([
            computeTodaySummary(workerId),
            computeTierSummary(workerId),
            computePayoutStatus(workerId),
            computeSafetyScore(workerId),
            computeLeadershipStatus(workerId),
            computeReferralStatus(workerId),
        ]);

        const lang = (req.headers["x-app-lang"] || "en").toLowerCase();

        const promoBanners = await getPromoBannersForWorker({
            workerId,
            lang,
            ctx,
            publicBaseUrl,
        });

        return res.json({
            success: true,
            data: {
                today,
                tier,
                payout,
                safety,
                leadership,
                referral,
                systemBanners,
                promoBanners,   // 🔥 already language-selected image
            },
        });
    } catch (e) {
        console.error("Worker home personalization error:", e);
        return res.status(500).json({
            success: false,
            message: "Failed to load home personalization",
        });
    }
};
