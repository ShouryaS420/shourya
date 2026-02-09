import mongoose from 'mongoose';
import jwt from "jsonwebtoken";
const { Schema } = mongoose;

const openTask = new Schema({
    taskName: { type: String, default: "" },
    taskStages: [{
        stageName: { type: String, default: "" },
        status: { type: String, default: "" },
    }]
}, { timestamps: true });

const vendorUserSchema = new Schema({
    userId: { type: String, },
    username: { type: String, },
    fullName: { type: String, default: "" },
    // Tenant / Project scope for attendance locations (required for nearest search security)
    projectId: { type: String, index: true },
    email: { type: String, },
    mobile: { type: String, },
    role: { type: String, default: "" },
    // Whether the vendor is eligible for auto-assignment
    isActive: { type: Boolean, default: true, index: true },

    // Soft capacity controls
    dailyLimit: { type: Number, default: 6 },       // max bookings/day
    assignedToday: { type: Number, default: 0 },    // reset nightly

    // Simple round-robin fairness
    lastAssignedAt: { type: Date, default: new Date(0), index: true },

    // Optional geography/skills for future matching
    city: String,
    serviceAreas: [String],
    department: { type: String, default: "" },
    openTask: [openTask],
    otp: String,
    otpExpiresAt: Date,

    // NEW: Attendance & Payroll controls (backward compatible)
    isRestricted: { type: Boolean, default: false },
    restrictionReason: { type: String, default: "" },

    // NEW: Multi locations allocated to this employee (office + sites)
    assignedLocationIds: [
        { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceLocation" }
    ],

    // NEW: Payroll configuration (defaults are safe)
    payroll: {
        salaryType: { type: String, enum: ["MONTHLY", "DAILY", "HOURLY"], default: "MONTHLY" },

        monthlySalary: { type: Number, default: 0 },
        perDayRate: { type: Number, default: 0 },
        hourlyRate: { type: Number, default: 0 },
        overtimeHourlyRate: { type: Number, default: 0 },

        // Shift policy (configurable later from admin)
        shiftStart: { type: String, default: "09:30" },
        shiftEnd: { type: String, default: "18:30" },
        graceMinsLate: { type: Number, default: 10 },

        // Attendance thresholds
        minHalfDayMins: { type: Number, default: 240 }, // 4 hours
        minFullDayMins: { type: Number, default: 480 }, // 8 hours
    },

    // ---- Onboarding (single source of truth) ----
    approvalStatus: {
        type: String,
        enum: ["NEW", "PENDING", "APPROVED", "REJECTED"],
        default: "NEW",
    },
    approvalNote: { type: String, default: "" },
    approvedAt: { type: Date },
    approvedBy: { type: String },

    // UI flow state
    onboardingStep: {
        type: String,
        enum: [
            "NEW",
            "HOME",
            "PROFILE",
            "SKILLS",
            "CITY",
            "SELFIE",
            "AADHAAR",
            "PAN",
            "CONSENT",
            "SUBMITTED",
            "DONE",
        ],
        default: "NEW",
    },

    // Profile data used by onboarding UI
    profile: {
        fullName: { type: String, default: "" },
        photoUrl: { type: String, default: "" }, // store uploaded URL
        preferredLanguage: { type: String, enum: ["en", "hi", "mr"], default: "en" },
    },

    // ✅ NEW: Bank Details (for payouts)
    bank: {
        status: {
            type: String,
            enum: ["NOT_ADDED", "PENDING", "VERIFIED", "FAILED"],
            default: "NOT_ADDED",
        },

        accountHolderName: { type: String, default: "" },
        accountNumber: { type: String, default: "" }, // store raw; UI will mask
        ifsc: { type: String, default: "" },
        bankName: { type: String, default: "" },
        branchName: { type: String, default: "" },

        upiId: { type: String, default: "" },

        // optional proof (later)
        cancelledChequeUrl: { type: String, default: "" },

        submittedAt: { type: Date, default: null },
        verifiedAt: { type: Date, default: null },
        failureReason: { type: String, default: "" },
    },

    skills: {
        type: [String], // store codes (e.g. "mason")
        default: [],
    },

    // ✅ V2 structured skills (domain → main → subskills)
    skillsV2: {
        construction: {
            type: Map,
            of: [String], // Map<mainKey, subKey[]>
            default: {},
        },
        interior: {
            type: Map,
            of: [String],
            default: {},
        },
    },

    // ✅ Derived helper (what domains user actually selected)
    skillsDomains: {
        type: [String],
        enum: ["construction", "interior"],
        default: [],
    },

    kyc: {
        status: {
            type: String,
            enum: ["NOT_STARTED", "PENDING", "VERIFIED", "FAILED"],
            default: "NOT_STARTED",
        },

        aadhaarFrontUrl: { type: String, default: "" },
        aadhaarBackUrl: { type: String, default: "" },
        panUrl: { type: String, default: "" },

        submittedAt: { type: Date },
        verifiedAt: { type: Date },
        failureReason: { type: String, default: "" },
    },

    consent: {
        termsAccepted: { type: Boolean, default: false },
        privacyAccepted: { type: Boolean, default: false },
        acceptedAt: { type: Date },
        termsVersion: { type: String, default: "v1" },
        privacyVersion: { type: String, default: "v1" },
    },

    readOnly: { type: Boolean, default: false },

    // Worker skill ladder profile (engine)
    skillCategory: {
        type: String,
        enum: ["HELPER", "SEMISKILLED", "SKILLED"],
        default: "HELPER",
    },
    skillLevel: { type: Number, min: 1, max: 4, default: 1 },

    payrollEnabled: { type: Boolean, default: false },

    // Main shift assignment (engine)
    // Workers do not choose; system uses this default shift
    defaultShift: { type: String, enum: ["A", "C"], default: "C" },

    lastAttendanceBonusAwardedAt: { type: Date, default: null },
    attendanceStreakCount: { type: Number, default: 0 },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

vendorUserSchema.methods.getJWTToken = function () {
    const expires = process.env.JWT_EXPIRE || "7d"; // set JWT_EXPIRE=7d
    return jwt.sign({ _id: this._id }, process.env.JWT_SECRET, { expiresIn: expires });
};

export default mongoose.model('vendor-users', vendorUserSchema);
