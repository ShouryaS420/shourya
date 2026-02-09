import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
    {
        lat: Number,
        lng: Number,
        accuracyM: Number,

        locationId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceLocation" },
        distanceM: Number,

        source: { type: String, default: "MOBILE" },
    },
    { _id: false }
);

const SwitchLogSchema = new mongoose.Schema(
    {
        at: { type: Date, required: true },

        fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceLocation", default: null },
        toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceLocation", required: true },

        selfieUrl: { type: String, default: "" },

        point: { type: PointSchema, default: null },
    },
    { _id: false }
);

const AttendanceSessionSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorUsers", required: true, index: true },
        dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD (IST)

        sessionNo: { type: Number, required: true },

        checkInAt: { type: Date },
        checkOutAt: { type: Date },

        checkIn: { type: PointSchema, default: null },
        checkOut: { type: PointSchema, default: null },

        // Selected / active location for this open session (PLOT or SITE)
        activeLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceLocation", default: null },
        // If active location is a plot, store the parent gated-community id (for Rule B checkout)
        activeCommunityId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceLocation", default: null },

        // Selfies
        checkInSelfieUrl: { type: String, default: "" },
        checkOutSelfieUrl: { type: String, default: "" },

        // Switch audit trail
        switchLogs: { type: [SwitchLogSchema], default: [] },

        durationMins: { type: Number, default: 0 },

        status: {
            type: String,
            enum: ["OPEN", "CLOSED", "AUTO_CLOSED"],
            default: "OPEN",
            index: true,
        },

        flags: { type: [String], default: [] },
    },
    { timestamps: true }
);

AttendanceSessionSchema.index({ vendorId: 1, dateKey: 1, sessionNo: 1 }, { unique: true });
AttendanceSessionSchema.index({ vendorId: 1, dateKey: 1, status: 1 });

export default mongoose.model("AttendanceSession", AttendanceSessionSchema);
