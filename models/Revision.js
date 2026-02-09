// models/Revision.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const revisionSchema = new Schema({
    designId: {
        type: Schema.Types.ObjectId,
        ref: 'Design',
        required: true
    },
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    comment: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
        default: 'NEW'
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
revisionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Revision', revisionSchema);
