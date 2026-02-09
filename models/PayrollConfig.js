import mongoose from "mongoose";
const { Schema } = mongoose;

const ShiftSchema = new Schema(
    {
        code: { type: String, enum: ["A", "C"], required: true },
        startHHMM: { type: String, required: true },
        endHHMM: { type: String, required: true },
        multiplier: { type: Number, required: true },
    },
    { _id: false }
);

const WageLevelSchema = new Schema(
    {
        L1: { type: Number, default: 0 },
        L2: { type: Number, default: 0 },
        L3: { type: Number, default: 0 },
        L4: { type: Number, default: 0 },
    },
    { _id: false }
);

const PayrollConfigSchema = new Schema(
    {
        key: { type: String, unique: true, required: true, default: "ACTIVE" },

        graceMinsLate: { type: Number, default: 0 },
        dailyComplianceBonusAmount: { type: Number, default: 50 },

        // ✅ Required shifts with defaults
        shifts: {
            A: {
                type: ShiftSchema,
                required: true,
                default: { code: "A", startHHMM: "07:00", endHHMM: "19:00", multiplier: 1.5 },
            },
            C: {
                type: ShiftSchema,
                required: true,
                default: { code: "C", startHHMM: "10:00", endHHMM: "18:00", multiplier: 1.0 },
            },
        },

        // ✅ Required wageMatrix with defaults
        wageMatrix: {
            HELPER: { type: WageLevelSchema, required: true, default: () => ({}) },
            SEMISKILLED: { type: WageLevelSchema, required: true, default: () => ({}) },
            SKILLED: { type: WageLevelSchema, required: true, default: () => ({}) },
        },
    },
    { timestamps: true }
);

const PayrollConfig =
    mongoose.models.PayrollConfig || mongoose.model("PayrollConfig", PayrollConfigSchema);

export default PayrollConfig;