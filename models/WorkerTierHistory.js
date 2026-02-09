import mongoose from "mongoose";

const { Schema } = mongoose;

const MetricsSnapshotSchema = new Schema(
    {
        attendanceRate: Number,
        absenceCount: Number,
        onTimeRate: Number,
        safetyRate: Number,
        avgDailyWage: Number,
        daysWorked: Number
    },
    { _id: false }
);

const WorkerTierHistorySchema = new Schema(
    {
        workerId: {
            type: Schema.Types.ObjectId,
            ref: "vendor-users",
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: [
                "WARNING",
                "PROBATION_START",
                "PROBATION_CLEAR",
                "DEMOTION",
                "PROMOTION"
            ],
            required: true,
            index: true
        },

        fromTier: {
            type: String,
            enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"]
        },

        toTier: {
            type: String,
            enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"]
        },

        evaluationType: {
            type: String,
            enum: ["WEEKLY", "MONTHLY"],
            required: true,
            index: true
        },

        evaluationPeriod: {
            type: String,
            required: true,
            index: true
            // examples: "2026-W03", "2026-01"
        },

        metricsSnapshot: {
            type: MetricsSnapshotSchema
        },

        reasonCode: {
            type: String
            // e.g. LOW_ATTENDANCE, SEVERE_ABSENT, CONSISTENT_PERFORMANCE
        },

        reward: {
            code: { type: String },
            amount: { type: Number },
        },
    },
    { timestamps: true }
);

export default mongoose.model(
    "WorkerTierHistory",
    WorkerTierHistorySchema
);
