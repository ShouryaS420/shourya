import { ALL_BANNER_CODES, BANNER_CODES } from "../constants/bannerCatalog.js";
import AppBanner from "../models/AppBanner.js";
import { inferPlacement } from "../services/bannerRules.js";

function normalizeCode(code) {
    return String(code || "").trim().toUpperCase();
}

function hasAnyVariant(variants) {
    return (
        (variants?.en && variants.en.length > 0) ||
        (variants?.hi && variants.hi.length > 0) ||
        (variants?.mr && variants.mr.length > 0)
    );
}

function withComputedFields(doc) {
    if (!doc) return doc;
    const code = normalizeCode(doc.code);
    return {
        ...doc,
        code,
        placement: inferPlacement(code), // derived, not stored
    };
}

/** LIST */
export const listBanners = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
        const skip = (page - 1) * limit;

        const q = {};
        if (req.query.active === "true") q.active = true;
        if (req.query.active === "false") q.active = false;

        const [rows, total] = await Promise.all([
            AppBanner.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
            AppBanner.countDocuments(q),
        ]);

        return res.json({
            success: true,
            data: rows.map(withComputedFields),
            meta: { page, limit, total },
        });
    } catch (e) {
        console.error("listBanners error", e);
        return res.status(500).json({ success: false });
    }
};

/** GET ONE */
export const getBanner = async (req, res) => {
    try {
        const row = await AppBanner.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ success: false, message: "NOT_FOUND" });
        return res.json({ success: true, data: withComputedFields(row) });
    } catch (e) {
        console.error("getBanner error", e);
        return res.status(500).json({ success: false });
    }
};

/** CREATE */
export const createBanner = async (req, res) => {
    try {
        const code = normalizeCode(req.body.code);
        const variants = req.body.variants || {};

        if (!code) {
            return res.status(400).json({ success: false, message: "CODE_REQUIRED" });
        }
        if (!ALL_BANNER_CODES.has(code)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_CODE",
                allowedCodes: Array.from(ALL_BANNER_CODES),
            });
        }

        if (!hasAnyVariant(variants)) {
            return res.status(400).json({
                success: false,
                message: "AT_LEAST_ONE_LANGUAGE_REQUIRED",
            });
        }

        const created = await AppBanner.create({
            code,
            variants: {
                en: Array.isArray(variants.en) ? variants.en : [],
                hi: Array.isArray(variants.hi) ? variants.hi : [],
                mr: Array.isArray(variants.mr) ? variants.mr : [],
            },
            active: req.body.active !== undefined ? Boolean(req.body.active) : true,
        });

        return res.json({ success: true, data: withComputedFields(created.toObject()) });
    } catch (e) {
        console.error("createBanner error", e);
        if (String(e?.code) === "11000") {
            return res.status(409).json({ success: false, message: "CODE_ALREADY_EXISTS" });
        }
        return res.status(500).json({ success: false });
    }
};

/** UPDATE */
export const updateBanner = async (req, res) => {
    try {
        const code = normalizeCode(req.body.code);
        const variants = req.body.variants || {};

        if (!code) {
            return res.status(400).json({ success: false, message: "CODE_REQUIRED" });
        }
        if (!ALL_BANNER_CODES.has(code)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_CODE",
                allowedCodes: Array.from(ALL_BANNER_CODES),
            });
        }
        if (!hasAnyVariant(variants)) {
            return res.status(400).json({
                success: false,
                message: "AT_LEAST_ONE_LANGUAGE_REQUIRED",
            });
        }

        const updated = await AppBanner.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    code,
                    variants: {
                        en: Array.isArray(variants.en) ? variants.en : [],
                        hi: Array.isArray(variants.hi) ? variants.hi : [],
                        mr: Array.isArray(variants.mr) ? variants.mr : [],
                    },
                    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
                },
            },
            { new: true }
        ).lean();

        if (!updated) return res.status(404).json({ success: false, message: "NOT_FOUND" });
        return res.json({ success: true, data: withComputedFields(updated) });
    } catch (e) {
        console.error("updateBanner error", e);
        if (String(e?.code) === "11000") {
            return res.status(409).json({ success: false, message: "CODE_ALREADY_EXISTS" });
        }
        return res.status(500).json({ success: false });
    }
};

/** DELETE */
export const deleteBanner = async (req, res) => {
    try {
        const deleted = await AppBanner.findByIdAndDelete(req.params.id).lean();
        if (!deleted) return res.status(404).json({ success: false, message: "NOT_FOUND" });
        return res.json({ success: true });
    } catch (e) {
        console.error("deleteBanner error", e);
        return res.status(500).json({ success: false });
    }
};

export const listBannerCodes = async (req, res) => {
    try {
        return res.json({
            success: true,
            data: {
                homeTop: BANNER_CODES.HOME_TOP,
                homeInfo: BANNER_CODES.HOME_INFO,
            },
        });
    } catch (error) {
        console.error("Failed to list banner codes", error);
        return res.status(500).json({ success: false, message: "INTERNAL_ERROR" });
    }
};
