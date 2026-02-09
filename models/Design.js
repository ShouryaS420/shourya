// models/Design.js
import mongoose from 'mongoose';

const designSchema = new mongoose.Schema({
    clientId: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    designType: { type: String, enum: ["2D", "3D"], required: true },
    fileUrls: [{ type: String }], // Assuming images are stored as URLs
    status: {
        type: String,
        enum: ['ACTIVE', 'REVISED', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-update `updatedAt`
designSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Design', designSchema);
