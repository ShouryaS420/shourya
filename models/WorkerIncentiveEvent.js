// models/WorkerIncentiveEvent.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const WorkerIncentiveEventSchema = new Schema(
    {
        workerId: { type: Schema.Types.ObjectId, ref: "vendor-users", required: true, index: true },

        source: {
            type: String,
            enum: ["LEADERSHIP_PROGRAM"],
            required: true,
            index: true,
        },

        sourceId: { type: Schema.Types.ObjectId, required: true, index: true }, // programId

        kind: {
            type: String,
            enum: ["LEADER_BONUS", "MEMBER_BONUS"],
            required: true,
            index: true,
        },

        amount: { type: Number, required: true },

        effectiveDateKey: { type: String, required: true, index: true }, // YYYY-MM-DD, decides which weekly settlement includes it

        status: {
            type: String,
            enum: ["APPROVED", "PAID"],
            default: "APPROVED",
            index: true,
        },

        meta: { type: Object, default: {} }, // snapshot: stage,difficulty,attendance participation etc
    },
    { timestamps: true }
);

// Idempotency: one payout of each kind per worker per program
WorkerIncentiveEventSchema.index(
    { workerId: 1, source: 1, sourceId: 1, kind: 1 },
    { unique: true }
);

export default mongoose.model("WorkerIncentiveEvent", WorkerIncentiveEventSchema);
