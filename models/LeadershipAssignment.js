import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipAssignmentSchema = new Schema(
    {
        programId: { type: Schema.Types.ObjectId, ref: "LeadershipProgram", required: true, index: true },
        leaderId: { type: Schema.Types.ObjectId, ref: "vendor-users", required: true, index: true },

        preferredTeamSize: { type: Number, required: true },

        status: {
            type: String,
            enum: ["APPLIED", "REJECTED", "APPROVED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "PAYOUT_POSTED"],
            default: "APPLIED",
            index: true,
        },

        appliedAt: { type: Date, default: Date.now },

        adminReviewedAt: { type: Date, default: null },
        adminReviewedBy: { type: String, default: "" },
        adminNote: { type: String, default: "" },

        approvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

LeadershipAssignmentSchema.index({ programId: 1, leaderId: 1 }, { unique: true });

export default mongoose.model("LeadershipAssignment", LeadershipAssignmentSchema);
