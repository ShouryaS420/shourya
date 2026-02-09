// models/LeadershipPolicyConfig.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipPolicyConfigSchema = new Schema(
    {
        stage: {
            type: String,
            enum: [
                "SHUTTERING",
                "BAR_BENDING",
                "SLAB_CASTING",
                "CURING",
                "DESHUTTERING",
                "MASONRY",
                "PLASTERING",
                "FINISHING",
                "OTHER",
            ],
            required: true,
            index: true,
        },

        difficulty: {
            type: String,
            enum: ["EASY", "STANDARD", "HARD", "CRITICAL"],
            required: true,
            index: true,
        },

        // System-decided thresholds
        minTier: {
            type: String,
            enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"],
            required: true,
        },

        minAttendancePct30d: { type: Number, required: true },
        minOnTimePct30d: { type: Number, required: true },
        minSafetyPct30d: { type: Number, required: true },

        note: { type: String, default: "" },

        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

LeadershipPolicyConfigSchema.index({ stage: 1, difficulty: 1 }, { unique: true });

export default mongoose.model("LeadershipPolicyConfig", LeadershipPolicyConfigSchema);
