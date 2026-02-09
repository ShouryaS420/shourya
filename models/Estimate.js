// models/Estimate.js
import mongoose from "mongoose";
import Counter from "./Counter.js";

const FileMetaSchema = new mongoose.Schema(
    { name: String, uri: String, size: Number },
    { _id: false }
);

const EstimateSchema = new mongoose.Schema(
    {
        siteKey: { type: String, index: true },
        humanId: { type: String, index: true },       // EST-00001
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        source: { type: String, enum: ["quick", "custom"], default: "quick" },

        // Location
        location: {
            displayName: String,
            fullAddress: String,
            coords: { lat: Number, lng: Number },
            city: String,
        },

        // Plot & floors
        projectType: { type: String, default: "residential" },
        units: { type: String, enum: ["m", "ft"], default: "m" },
        baseLevel: { type: String, enum: ["G", "P"], default: "G" },
        floorsAbove: { type: Number, default: 0 },
        floorsAreas: { type: [Number], default: [] }, // per-floor built-up ft²
        builtUpTotalFt2: { type: Number, default: 0 },

        // Plot geometry (optional — captured to reproduce calc later)
        shape: { type: String, enum: ["rectangle", "trapezoid", "triangle", "segments"], default: "rectangle" },
        rect: { width: Number, length: Number }, // units = units
        trapezoid: { a: Number, b: Number, h: Number },
        triangle: { b: Number, h: Number },
        segments: [{ w: Number, l: Number }],

        // Authority & design
        authority: { type: String, enum: ["pmrda", "pmc", "pcmc", ""], default: "" },
        designSelected: { type: Map, of: Boolean, default: {} }, // {floorPlan:true,...}
        designFiles: { type: Map, of: FileMetaSchema, default: {} }, // {floorPlan:{...}}

        // Site/plot conditions
        soilType: { type: String, enum: ["soft", "medium", "hard", "rocky", "black_cotton", ""], default: "" },
        terrain: { type: String, enum: ["flat", "slight", "steep", "low", ""], default: "" },
        neighbor: {
            left: { type: String, enum: ["yes", "no", "under_development", ""], default: "" },
            back: { type: String, enum: ["yes", "no", "under_development", ""], default: "" },
            right: { type: String, enum: ["yes", "no", "under_development", ""], default: "" },
        },
        road: {
            width: Number,
            units: { type: String, enum: ["m", "ft"], default: "m" },
        },

        // Recommendation / package
        recommendation: {
            selectedPreset: { type: String, enum: ["economy", "standard", "luxury", "royal", null], default: null },
            areaFt2: { type: Number, default: 0 }, // effective area used for pricing
            city: { type: String, default: "Pune" },
            perFt2Base: { type: Number, default: 0 }, // resolved city base for the preset
            plinthAreaFt2: { type: Number, default: 0 },
            plinthRate: { type: Number, default: 0 },
            headRoomAreaFt2: { type: Number, default: 0 },
            headRoomRate: { type: Number, default: 0 },
        },

        // Server-side computed pricing (authoritative)
        pricing: {
            perFt2: { type: Number, default: 0 },
            base: { type: Number, default: 0 },
            plinthAmt: { type: Number, default: 0 },
            headAmt: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },

        // Simple status lifecycle for your Quotation screen
        status: {
            type: String,
            enum: ["Pending", "Connecting RM", "Meeting Scheduled", "Approved Proposal", "draft",
                "waiting_admin_approval", // RM has submitted to admin
                "approved",               // admin approved
                "rejected",],
            default: "Pending",
        },

        /**
         * Once admin approves and we create a project for this estimate,
         * we store the link to that project here.
         */
        linkedProjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectDetails",
            default: null,
            index: true,
        },

        // Presentation helpers
        title: String,   // e.g., "G+1 • Pune"
        cityTag: String, // e.g., "Pune"

        pdfUrl: { type: String },          // public HTTPS URL to uploaded BOQ PDF
        pdfUpdatedAt: { type: Date },
    },
    { timestamps: true }
);

// Auto-increment humanId (EST-00001)
EstimateSchema.pre("save", async function (next) {
    if (this.humanId) return next();
    const ctr = await Counter.findOneAndUpdate(
        { name: "estimate" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const n = String(ctr.seq).padStart(5, "0");
    this.humanId = `EST-${n}`;
    next();
});

EstimateSchema.index({ user: 1, source: 1, siteKey: 1, "recommendation.selectedPreset": 1 });
export default mongoose.models.Estimate || mongoose.model("Estimate", EstimateSchema);