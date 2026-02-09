// controllers/adminTranslateController.js
import translate from "translate";

translate.engine = "libre";
translate.url = process.env.LIBRETRANSLATE_URL; // e.g. http://127.0.0.1:5000

export const translateBannerCopy = async (req, res) => {
    try {
        const { titleEn = "", subtitleEn = "" } = req.body || {};
        if (!titleEn.trim() && !subtitleEn.trim()) {
            return res.status(400).json({ success: false, message: "titleEn or subtitleEn required" });
        }

        const [titleHi, titleMr, subtitleHi, subtitleMr] = await Promise.all([
            titleEn ? translate(titleEn, { from: "en", to: "hi" }) : "",
            titleEn ? translate(titleEn, { from: "en", to: "mr" }) : "",
            subtitleEn ? translate(subtitleEn, { from: "en", to: "hi" }) : "",
            subtitleEn ? translate(subtitleEn, { from: "en", to: "mr" }) : "",
        ]);

        return res.json({
            success: true,
            data: {
                title: { hi: titleHi || "", mr: titleMr || "" },
                subtitle: { hi: subtitleHi || "", mr: subtitleMr || "" },
            },
        });
    } catch (e) {
        console.error("translateBannerCopy error", e);
        return res.status(500).json({ success: false, message: "Translate failed" });
    }
};
