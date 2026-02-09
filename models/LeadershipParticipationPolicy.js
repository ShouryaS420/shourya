// models/LeadershipParticipationPolicy.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadershipParticipationPolicySchema = new Schema(
    {
        minDaysParticipation: { type: Number, default: 2 }, // hard gate
        enforceNoOverlap: { type: Boolean, default: true },
        enforceSameSite: { type: Boolean, default: false }, // enable later when siteId exists
        maxConcurrentPrograms: { type: Number, default: 1 },
    },
    { timestamps: true }
);

export default mongoose.model(
    "LeadershipParticipationPolicy",
    LeadershipParticipationPolicySchema
);
