import mongoose from 'mongoose';
const { Schema } = mongoose;

const conversationSchema = new Schema({
    message: { type: String },
    name: { type: String },
    issuedImage: { type: Array, default: [] },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false }); 

const raiseTicketSchema = new Schema({
    mainUserID: { type: String },
    ticketId: { type: String },
    mainIssue: { type: String },
    subIssue: { type: String },
    describeIssue: { type: String },
    contactEmail: { type: String },
    issueImage: { type: Array, default: [] },
    userName: { type: String },
    userEmail: { type: String },
    userMobile: { type: String },
    conversation: [conversationSchema],
    status: { type: String, default: "OPEN" },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model('raise-ticket', raiseTicketSchema);
