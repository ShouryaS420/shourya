import mongoose from 'mongoose';
const { Schema } = mongoose;

const familyMemberSchema = new Schema({
    mainUserID: { type: String },
    name: { type: String },
    email: { type: String },
    mobile: { type: String },
    relationship: { type: String },
});

export default mongoose.model('Family-member', familyMemberSchema);
