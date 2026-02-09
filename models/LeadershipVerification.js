// models/LeadershipVerification.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipVerificationSchema = new Schema(
    {
        programId: { type: Schema.Types.ObjectId, ref: "LeadershipProgram", required: true, unique: true },

        supervisor: {
            name: { type: String, default: "" },
            mobile: { type: String, default: "" },
            verifiedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null }, // using admin auth for now
        },

        verifiedAt: { type: Date, default: null },

        decision: {
            type: String,
            enum: ["PENDING", "PASS", "FAIL"],
            default: "PENDING",
            index: true,
        },

        remarks: { type: String, default: "" },

        qcScores: {
            quality: { type: Number, default: 0 }, // 0-100 optional
            safety: { type: Number, default: 0 },
            speed: { type: Number, default: 0 },
        },

        evidence: {
            photos: { type: [String], default: [] },
        },
    },
    { timestamps: true }
);

export default mongoose.model("LeadershipVerification", LeadershipVerificationSchema);
