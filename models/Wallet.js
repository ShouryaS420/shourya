// models/Wallet.js
import mongoose from "mongoose";

const WalletLedgerSchema = new mongoose.Schema(
    {
        referralId: { type: mongoose.Schema.Types.ObjectId, ref: "Referral" },
        type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
        milestone: { type: String, default: "REFERRAL_PAYOUT" },
        amount: { type: Number, required: true }, // gross
        tds: { type: Number, default: 0 },
        net: { type: Number, required: true },
        at: { type: Date, default: Date.now },
        txId: String,
        status: { type: String, enum: ["posted", "withdrawn"], default: "posted" },
    },
    { _id: false }
);

const WalletSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
        balance: { type: Number, default: 0 },
        ledger: [WalletLedgerSchema],
    },
    { timestamps: true }
);

export default mongoose.model("Wallet", WalletSchema);
