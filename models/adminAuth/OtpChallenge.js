import mongoose from 'mongoose';

const OtpChallengeSchema = new mongoose.Schema({
    email: { type: String, index: true, required: true },
    codeHash: { type: String, required: true },   // hash of 6-digit code
    purpose: { type: String, enum: ['login'], default: 'login' },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true }, // TTL index below
    consumedAt: { type: Date },
}, { timestamps: true });

// TTL (auto-delete at expiresAt)
OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpChallenge', OtpChallengeSchema);
