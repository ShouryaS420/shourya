import mongoose from "mongoose";
import PayrollConfig from "../models/PayrollConfig.js";

async function run() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGO_URI / MONGODB_URI in env");

    await mongoose.connect(uri);

    const payload = {
        key: "ACTIVE",
        graceMinsLate: 10,
        dailyComplianceBonusAmount: 50,
        shifts: {
            A: { code: "A", startHHMM: "07:00", endHHMM: "19:00", multiplier: 1.5 },
            C: { code: "C", startHHMM: "10:00", endHHMM: "18:00", multiplier: 1.0 },
        },
        wageMatrix: {
            HELPER: { L1: 600, L2: 650, L3: 700, L4: 750 },
            SEMISKILLED: { L1: 750, L2: 800, L3: 850, L4: 900 },
            SKILLED: { L1: 900, L2: 1000, L3: 1100, L4: 1200 },
        },
    };

    const cfg = await PayrollConfig.findOneAndUpdate(
        { key: "ACTIVE" },
        { $set: payload },
        { upsert: true, new: true }
    );

    console.log("Seeded PayrollConfig:", cfg._id.toString());
    await mongoose.disconnect();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
