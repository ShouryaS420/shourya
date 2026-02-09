// models/Activity.js
import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema({
    userId: { type: String, index: true, required: true },      // the end user (client) this belongs to
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectDetails', index: true },
    type: { type: String, required: true },  // e.g., 'site_visit.scheduled', 'site_visit.completed', 'design.consultation', 'stage.changed', 'ticket.message'
    title: { type: String, required: true }, // short one-line: 'Site Visit Scheduled'
    details: { type: String, default: '' },  // brief detail/notes
    // actor (who made it)
    actor: {
        id: { type: String },                   // employeeId or system id
        name: { type: String },                 // employee full name
        role: { type: String },                 // e.g., 'Site Engineer', 'Designer', 'System'
        avatarUrl: { type: String },
        type: { type: String, default: 'employee' }, // 'employee' | 'system' | 'client'
    },
    // optional extra context
    meta: {
        stage: String,
        phase: String,
        when: Date,               // scheduled time, if relevant
        location: String,
        ticketId: String,
        quotationId: String,
        paymentMilestone: String,
        changedFrom: String,
        changedTo: String,
    }
}, { timestamps: true });

ActivitySchema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('Activity', ActivitySchema);
