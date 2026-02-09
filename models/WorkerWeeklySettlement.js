// models/WorkerWeeklySettlement.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const WorkerWeeklySettlementSchema = new Schema(
    {
        workerId: { type: Schema.Types.ObjectId, ref: "vendor-users", required: true, index: true },

        weekStartKey: { type: String, required: true, index: true }, // YYYY-MM-DD (Monday)
        weekEndKey: { type: String, required: true },               // Saturday

        // Counts
        daysWorked: { type: Number, default: 0 },
        shiftA_days: { type: Number, default: 0 },
        shiftC_days: { type: Number, default: 0 },
        subshift_days: { type: Number, default: 0 },
        absent_days: { type: Number, default: 0 },

        // Money
        grossPay: { type: Number, default: 0 },
        complianceBonusTotal: { type: Number, default: 0 }, // ₹50/day sum
        attendance30Bonus: { type: Number, default: 0 },
        netPay: { type: Number, default: 0 },

        // Snapshot (very important for audits)
        wageSnapshot: {
            skillCategory: { type: String },
            skillLevel: { type: Number },
            basicDailyWageUsed: { type: Number },
            shiftA_multiplier: { type: Number },
            shiftC_multiplier: { type: Number },
        },

        // Status
        status: {
            state: { type: String, enum: ["DRAFT", "FINAL", "PAID"], default: "DRAFT" },
            paidAt: { type: Date, default: null },
        },

        incentiveTotal: { type: Number, default: 0 },
        incentiveBreakdown: { type: [Object], default: [] }, // small snapshot for audit

        locked: { type: Boolean, default: false },
    },
    { timestamps: true }
);

WorkerWeeklySettlementSchema.index({ workerId: 1, weekStartKey: 1 }, { unique: true });

export default mongoose.model("WorkerWeeklySettlement", WorkerWeeklySettlementSchema);
