// models/LeadershipSubmission.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipSubmissionSchema = new Schema(
    {
        programId: { type: Schema.Types.ObjectId, ref: "LeadershipProgram", required: true, unique: true },
        leaderId: { type: Schema.Types.ObjectId, ref: "vendor-users", required: true },

        submittedAt: { type: Date, default: Date.now },

        checklist: {
            // generic checklist – stage-specific can be added later
            workCompleted: { type: Boolean, default: false },
            safetyFollowed: { type: Boolean, default: false },
            qualitySelfCheck: { type: Boolean, default: false },
            cleanupDone: { type: Boolean, default: false },
        },

        notes: { type: String, default: "" },

        evidence: {
            // keep as array of URLs (your upload.js can upload images and return URL)
            photos: { type: [String], default: [] },
            files: { type: [String], default: [] },
        },
    },
    { timestamps: true }
);

export default mongoose.model("LeadershipSubmission", LeadershipSubmissionSchema);
