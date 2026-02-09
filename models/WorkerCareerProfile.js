import mongoose from "mongoose";

const { Schema } = mongoose;

const ProbationSchema = new Schema(
    {
        isOnProbation: { type: Boolean, default: false },
        since: { type: Date },
        reason: { type: String }
    },
    { _id: false }
);

const WorkerCareerProfileSchema = new Schema(
    {
        workerId: {
            type: Schema.Types.ObjectId,
            ref: "vendor-users",
            required: true,
            unique: true,
            index: true
        },

        currentTier: {
            type: String,
            enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"],
            default: "BRONZE",
            index: true
        },

        probation: {
            type: ProbationSchema,
            default: () => ({ isOnProbation: false })
        },

        warningCount: {
            type: Number,
            default: 0
        },

        lastWeeklyEvalAt: { type: Date },
        lastMonthlyEvalAt: { type: Date },

        nextWeeklyEvalAt: { type: Date },
        nextMonthlyEvalAt: { type: Date },

        rewards: [
            {
                code: { type: String, required: true }, // e.g. "TIER_PROMOTION_BONUS"
                amount: { type: Number, required: true },
                status: { type: String, enum: ["PENDING", "APPLIED", "CANCELLED"], default: "PENDING" },
                createdAt: { type: Date, default: Date.now },
                appliedAt: { type: Date, default: null },
                meta: { type: Object, default: {} }, // optional: { fromTier, toTier, period }
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model(
    "WorkerCareerProfile",
    WorkerCareerProfileSchema
);
