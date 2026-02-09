// models/LeadershipApplication.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipApplicationSchema = new Schema(
    {
        programId: {
            type: Schema.Types.ObjectId,
            ref: "LeadershipProgram",
            required: true,
            index: true,
        },

        // NOTE: our actual worker model name is "vendor-users"
        workerId: {
            type: Schema.Types.ObjectId,
            ref: "vendor-users",
            required: true,
            index: true,
        },

        appliedAt: { type: Date, default: Date.now },

        // Option A: leader proposes the team upfront
        preferredTeamSize: { type: Number, default: null },
        memberWorkerIds: [
            { type: Schema.Types.ObjectId, ref: "vendor-users", default: [] },
        ],

        eligibilitySnapshot: {
            type: Object, // snapshot from evaluateLeadershipEligibility
            default: {},
        },

        status: {
            type: String,
            enum: ["APPLIED", "REJECTED", "SELECTED"],
            default: "APPLIED",
            index: true,
        },

        rejectionReason: { type: String, default: "" },
        adminNote: { type: String, default: "" },
        decidedAt: { type: Date, default: null },

        rankingScore: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// One worker can apply only once per program
LeadershipApplicationSchema.index({ programId: 1, workerId: 1 }, { unique: true });

export default mongoose.model("LeadershipApplication", LeadershipApplicationSchema);
