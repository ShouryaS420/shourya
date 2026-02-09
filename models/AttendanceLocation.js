// models/AttendanceLocation.js
import mongoose from "mongoose";

const PolygonPointSchema = new mongoose.Schema(
    { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    { _id: false }
);

const AttendanceLocationSchema = new mongoose.Schema(
    {
        // ✅ NOT compulsory anymore
        // if you still want filtering by tenant, we'll do it in controller by optional projectId
        projectId: { type: String, required: false, index: true, default: null },

        type: {
            type: String,
            enum: ["COMMUNITY", "PLOT", "SITE", "OFFICE"],
            default: "SITE",
            index: true,
        },

        name: { type: String, required: true, trim: true },

        // ✅ For COMMUNITY: lat/lng is optional (we store centroid if you pass it)
        // ✅ For SITE/PLOT/OFFICE: required
        lat: { type: Number, required: false },
        lng: { type: Number, required: false },

        radiusM: { type: Number, default: 150 },

        parentCommunityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AttendanceLocation",
            default: null,
            index: true,
        },

        plotNo: { type: String, default: "" },

        // ✅ legacy polygon (keep)
        polygon: { type: [PolygonPointSchema], default: [] },

        // ✅ NEW: Multi polygons for COMMUNITY
        polygons: { type: [[PolygonPointSchema]], default: [] },

        // ✅ NEW: optional markers inside community
        markers: { type: [PolygonPointSchema], default: [] },

        isActive: { type: Boolean, default: true, index: true },

        geo: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: undefined }, // [lng, lat]
        },

        attendancePolicy: {
            requireAssignment: { type: Boolean, default: true },
        },

        address: { type: String, default: "" },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

AttendanceLocationSchema.index({ geo: "2dsphere" });
// optional index (works even when projectId is null)
AttendanceLocationSchema.index({ projectId: 1, type: 1, isActive: 1 });

AttendanceLocationSchema.pre("save", function (next) {
    // ✅ Only set geo if lat/lng exists
    if (Number.isFinite(this.lat) && Number.isFinite(this.lng)) {
        this.geo = { type: "Point", coordinates: [this.lng, this.lat] };
    } else {
        this.geo = undefined; // avoid invalid geo
    }
    next();
});

export default mongoose.model("AttendanceLocation", AttendanceLocationSchema);
