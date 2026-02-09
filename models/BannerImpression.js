import mongoose from "mongoose";
const { Schema } = mongoose;

const BannerImpressionSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true, index: true },
        bannerCode: { type: String, required: true, index: true },
        lastShownAt: { type: Date, default: null },
        shownCountToday: { type: Number, default: 0 },
        dayKey: { type: String, default: "" }, // "YYYY-MM-DD"
    },
    { timestamps: true }
);

BannerImpressionSchema.index({ userId: 1, bannerCode: 1 }, { unique: true });

export default mongoose.model("BannerImpression", BannerImpressionSchema);
