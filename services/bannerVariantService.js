// services/bannerVariantService.js
import crypto from "crypto";

const SUPPORTED = ["en", "hi", "mr"];

function stableHashInt(str) {
    const hash = crypto.createHash("md5").update(String(str)).digest("hex");
    return parseInt(hash.slice(0, 8), 16);
}

/**
 * Rotation seed that changes every N seconds
 * Example:
 *  1   -> every second (testing)
 *  86400 -> daily
 *  172800 -> every 2 days
 */
export function rotationSeedSeconds({
    rotateSeconds,
    userId = "all",
    now = Date.now(),
}) {
    const sec = Math.max(1, Number(rotateSeconds || 1));
    const bucket = Math.floor(now / (sec * 1000));
    return stableHashInt(`${userId}:${bucket}`);
}

/**
 * Pick 1 image variant deterministically for this user + banner + language.
 * Falls back to en -> hi -> mr if requested lang has no images.
 */
export function pickBannerVariant({ userLang, variants }) {
    if (!variants) return null;

    if (userLang === "hi" && variants.hi?.length) return variants.hi[0];
    if (userLang === "mr" && variants.mr?.length) return variants.mr[0];

    // fallback to English
    if (variants.en?.length) return variants.en[0];

    return null;
}

