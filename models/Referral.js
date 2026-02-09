// models/Referral.js
import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema(
    {
        code: { type: String, index: true }, // referrer’s share code (from User or generated)
        referrerUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
            required: true,
        },

        referee: {
            name: String,
            phoneHash: { type: String, index: true },
            emailHash: { type: String, index: true },
            phoneTail: { type: String },
            city: String,
            plotAddress: String,
        },

        attribution: {
            firstTouchAt: Date,
            lastTouchAt: Date,
            windowDays: { type: Number, default: 180 }, // attribution window
        },

        project: {
            contractValue: { type: Number, default: 0 }, // signed amount (INR)
            package: {
                type: String,
                enum: ["economy", "standard", "luxury", "royal", null],
                default: null,
            },
            startedAt: Date, // construction start
            receiptsCollected: { type: Number, default: 0 }, // sum of paid receipts
        },

        policySnapshot: {
            referralRate: { type: Number, default: 0.01 }, // 1% default
            capINR: { type: Number, default: 400000 }, // cap; adjust as needed
        },

        status: {
            type: String,
            enum: [
                "SUBMITTED",
                "VALID",
                "CONVERTED",
                "UNDER_CONSTRUCTION",
                "ELIGIBLE_20",
                "PAYOUT_PROCESSING",
                "PAID",
                "REJECTED",
            ],
            default: "SUBMITTED",
            index: true,
        },

        eligibleAt: Date,

        payout: {
            amount: { type: Number, default: 0 }, // gross eligible (before TDS)
            tds: { type: Number, default: 0 },
            netAmount: { type: Number, default: 0 },
            paidAt: Date,
            txId: String,
        },

        events: [
            {
                type: { type: String }, // e.g., "CONTRACT_UPDATE", "RECEIPT_ADD", "START_SET", "ELIGIBLE_20", "PAID"
                at: Date,
                by: String,
                notes: String,
            },
        ],
    },
    { timestamps: true }
);

// Prevent duplicate phone across all time (when a phoneHash exists)
ReferralSchema.index(
    { "referee.phoneHash": 1 },
    { unique: true, sparse: true }
);
// Prevent duplicate email across all time (when an emailHash exists)
ReferralSchema.index(
    { "referee.emailHash": 1 },
    { unique: true, sparse: true }
);

export default mongoose.model("Referral", ReferralSchema);
