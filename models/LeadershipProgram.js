// models/LeadershipProgram.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipProgramSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: "" },

        siteLabel: { type: String, default: "" },

        stage: {
            type: String,
            enum: [
                "REBAR",
                "SHUTTERING",
                "BAR_BENDING",
                "SLAB_CASTING",
                "CURING",
                "DESHUTTERING",
                "MASONRY",
                "PLASTERING",
                "FINISHING",
                "QC",
                "SLAB",
                "OTHER",
            ],
            required: true,
            index: true,
        },

        difficulty: {
            type: String,
            enum: ["EASY", "STANDARD", "HARD", "CRITICAL"],
            default: "STANDARD",
            index: true,
        },

        requiredSkills: { type: [String], default: [] },

        teamRules: {
            teamSizeMin: { type: Number, default: 3 },
            teamSizeMax: { type: Number, default: 6 },
        },

        rewardPolicy: {
            leaderBonus: { type: Number, default: 0 },
            memberBonus: { type: Number, default: 0 },
            note: { type: String, default: "" },
        },

        applicationOpenAt: { type: Date, default: null },
        applicationCloseAt: { type: Date, default: null },
        startAt: { type: Date, default: null },
        dueAt: { type: Date, default: null },

        status: {
            type: String,
            enum: [
                "DRAFT",
                "PUBLISHED",
                "LEADER_SELECTED",
                "TEAM_FORMATION",
                "IN_PROGRESS",
                "SUBMITTED",
                "SUPERVISOR_VERIFIED",
                "ADMIN_APPROVED",
                "PAYOUT_POSTED",
                "REJECTED",
                "ARCHIVED",
            ],
            default: "DRAFT",
            index: true,
        },

        createdBy: { type: String, default: "" },
    },
    { timestamps: true }
);

LeadershipProgramSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("LeadershipProgram", LeadershipProgramSchema);
