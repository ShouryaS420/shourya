import mongoose from "mongoose";

const BannerVariantSchema = new mongoose.Schema(
    {
        imagePath: { type: String, required: true },
    },
    { _id: false }
);

const AppBannerSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
            index: true,
        },

        // Admin uploads ONLY images here
        variants: {
            en: { type: [BannerVariantSchema], default: [] },
            hi: { type: [BannerVariantSchema], default: [] },
            mr: { type: [BannerVariantSchema], default: [] },
        },

        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.model("AppBanner", AppBannerSchema);
