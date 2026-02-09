// models/LeadershipTeamMember.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipTeamMemberSchema = new Schema(
    {
        programId: {
            type: Schema.Types.ObjectId,
            ref: "LeadershipProgram",
            required: true,
            index: true,
        },

        workerId: {
            type: Schema.Types.ObjectId,
            ref: "VendorUser",
            required: true,
            index: true,
        },

        role: {
            type: String,
            enum: ["LEADER", "MEMBER"],
            required: true,
        },

        status: {
            type: String,
            enum: ["INVITED", "ACCEPTED", "DECLINED", "REMOVED"],
            default: "INVITED",
            index: true,
        },

        invitedAt: { type: Date, default: Date.now },
        respondedAt: { type: Date, default: null },

        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: "VendorUser", // leader id
            required: true,
        },
    },
    { timestamps: true }
);

// One worker only once per program
LeadershipTeamMemberSchema.index(
    { programId: 1, workerId: 1 },
    { unique: true }
);

export default mongoose.model(
    "LeadershipTeamMember",
    LeadershipTeamMemberSchema
);
