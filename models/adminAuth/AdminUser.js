import mongoose from 'mongoose';

const AdminUserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    avatarUrl: { type: String },
    googleId: { type: String }, // set after Google SSO
    role: { type: String, enum: ['founder', 'admin', 'employee'], required: true, default: 'employee' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

export default mongoose.model('AdminUser', AdminUserSchema);
