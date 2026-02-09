import mongoose from "mongoose";
const { Schema } = mongoose;

const EmailEventSchema = new Schema({
    event: { type: String, enum: ["sent", "open", "click", "delivery", "bounce", "complaint"], required: true },
    trackingId: { type: String, required: true, index: true },     // per-email unique id
    messageId: { type: String },                                    // if you capture from nodemailer
    to: { type: String, index: true },
    estimateId: { type: String, index: true },                      // humanId or _id
    campaign: { type: String },                                     // optional grouping tag
    link: { type: String },                                         // for click
    ip: { type: String },
    ua: { type: String },
    meta: { type: Object },
}, { timestamps: true });

EmailEventSchema.index({ trackingId: 1, event: 1 });
export default mongoose.model("EmailEvent", EmailEventSchema);
