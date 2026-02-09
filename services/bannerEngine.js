import AppBanner from "../models/AppBanner.js";
import {
    inferPlacement,
    resolveHomeTopRule,
    resolveHomeInfoRule,
} from "./bannerRules.js";
import { pickBannerVariant } from "./bannerVariantService.js";
import { rotationSeedSeconds } from "./bannerVariantService.js";

const MAX_HOME_TOP = 5;
const MAX_HOME_INFO = 2;

export async function buildHomeBanners({
    ctx,
    lang,
    publicBaseUrl,
    userId,
}) {
    const banners = await AppBanner.find({ active: true }).lean();

    const homeTop = [];
    const homeInfoCandidates = [];

    for (const b of banners) {
        const code = b.code.toUpperCase();
        const placement = inferPlacement(code);

        const variant = pickBannerVariant({
            userLang: lang,
            variants: b.variants,
        });

        if (!variant?.imagePath) continue;

        const imageUrl = `${publicBaseUrl}/${variant.imagePath.replace(/^\//, "")}`;

        if (placement === "HOME_TOP") {
            const rule = resolveHomeTopRule(code, ctx);
            if (!rule.eligible) continue;

            homeTop.push({
                code,
                imageUrl,
                deepLink: rule.deepLink,
                weight: rule.weight,
            });
            continue;
        }

        if (placement === "HOME_INFO") {
            homeInfoCandidates.push({
                code,
                imageUrl,
                deepLink: resolveHomeInfoRule(code),
            });
        }
    }

    // Sort HOME_TOP by priority
    homeTop.sort((a, b) => b.weight - a.weight);

    // 🔁 ROTATE HOME_INFO EVERY N SECONDS
    const rotateSeconds = Number(
        process.env.HOME_INFO_ROTATE_SECONDS || 172800
    );

    const seed = rotationSeedSeconds({
        rotateSeconds,
        userId: userId || "all",
    });

    const n = homeInfoCandidates.length;
    const start = n ? seed % n : 0;

    const homeInfo = [];
    for (let i = 0; i < Math.min(MAX_HOME_INFO, n); i++) {
        homeInfo.push(homeInfoCandidates[(start + i) % n]);
    }

    return {
        homeTopBanners: homeTop.slice(0, MAX_HOME_TOP),
        homeInfoBanners: homeInfo,
    };
}
