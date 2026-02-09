import mongoose from 'mongoose';

const AdminSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', index: true, required: true },
    refreshHash: { type: String, required: true }, // bcrypt hash of refresh token
    deviceId: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    expiresAt: { type: Date, index: true },
    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('AdminSession', AdminSessionSchema);
