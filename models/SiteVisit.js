// import mongoose from "mongoose";

// const CoordsSchema = new mongoose.Schema(
//     { lat: Number, lng: Number },
//     { _id: false }
// );

// const ReportItemSchema = new mongoose.Schema(
//     {
//         label: String,
//         value: String,
//         note: String,
//     },
//     { _id: false }
// );

// const ReportSectionSchema = new mongoose.Schema(
//     {
//         title: String,
//         items: [ReportItemSchema],
//     },
//     { _id: false }
// );

// const ReportSchema = new mongoose.Schema(
//     {
//         summary: String,
//         sections: [ReportSectionSchema],      // flexible sections (soil, access, services, risks, etc.)
//         photos: [String],                     // URLs
//         pdfUrl: String,                       // optional generated PDF URL
//         createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "vendor-users" },
//         verifiedBy: String, // admin
//         verifiedAt: Date,
//     },
//     { _id: false, timestamps: true }
// );

// const SiteVisitSchema = new mongoose.Schema(
//     {
//         userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//         siteKey: { type: String },                          // optional app-side key
//         bookingRef: { type: String, index: true },
//         address: { type: String, default: "" },
//         coords: { type: CoordsSchema },
//         when: { type: Date, required: true },

//         // scheduled | confirmed | rescheduled | completed | cancelled
//         status: { type: String, default: "scheduled", index: true },

//         // assignment
//         assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "vendor-users" },

//         // user notes during booking
//         notes: { type: String, default: "" },

//         // vendor fieldwork inputs (raw) saved before report is verified
//         vendorInputs: {
//             type: Object,
//             default: {}
//         },

//         // final clarity report (after verification)
//         report: ReportSchema,
//     },
//     { timestamps: true }
// );

// SiteVisitSchema.index({ userId: 1, createdAt: -1 });

// export default mongoose.model("SiteVisit", SiteVisitSchema);


import mongoose from "mongoose";

const CoordsSchema = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false });

const ReportItemSchema = new mongoose.Schema(
    { label: String, value: String, note: String },
    { _id: false }
);

const ReportSectionSchema = new mongoose.Schema(
    { title: String, items: [ReportItemSchema] },
    { _id: false }
);

const ReportSchema = new mongoose.Schema(
    {
        summary: String,
        sections: [ReportSectionSchema],
        photos: [String],
        pdfUrl: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "vendor-users" },
        verifiedBy: String,
        verifiedAt: Date,
    },
    { _id: false, timestamps: true }
);

const BookingMetaSchema = new mongoose.Schema(
    {
        name: String,
        mobile: String,
        email: String,
        city: String,
        budget: String,
        preferredSlot: String,
        whatsAppOptIn: { type: Boolean, default: true },
        source: { type: String, default: "website" },
    },
    { _id: false }
);

/**
 * ✅ IMPORTANT:
 * Add "expired" to flow steps so late replies do not break validation.
 * This also allows us to stop the flow cleanly after inactivity.
 */
const FLOW_STEPS = [
    "",
    "awaiting_confirm",
    "paused",
    "awaiting_reschedule",
    "awaiting_readiness",
    "awaiting_custom_time",
    "awaiting_budget",
    "awaiting_timeline",
    "awaiting_decision",
    "awaiting_summary",
    "completed",
    "canceled",
    "expired",
];

/**
 * Reminder tracking per step:
 * - count: how many reminders sent for the current step
 * - lastAt: last time we reminded
 */
const StepReminderSchema = new mongoose.Schema(
    {
        count: { type: Number, default: 0 },
        lastAt: Date,
    },
    { _id: false }
);

/**
 * Step send markers:
 * We store when the "current step prompt" was last sent, so reminders and recovery can work reliably.
 */
const StepSentAtSchema = new mongoose.Schema(
    {
        confirm: Date,
        nudge: Date,
        reschedule: Date,
        readiness: Date,
        custom_time: Date,
        budget: Date,
        timeline: Date,
        decision: Date,
        summary: Date,
        proceed_ack: Date,
        cancelled: Date,
    },
    { _id: false }
);

const NotifySchema = new mongoose.Schema(
    {
        // outbound scheduling (initial two messages)
        welcomeDueAt: Date,
        welcomeSentAt: Date,
        welcomeClaimedAt: Date,
        welcomeAttempts: { type: Number, default: 0 },
        welcomeLastError: { type: String, default: "" },

        reconDueAt: Date,
        reconSentAt: Date,
        reconClaimedAt: Date,
        reconAttempts: { type: Number, default: 0 },
        reconLastError: { type: String, default: "" },

        // flow tracking
        flowStep: { type: String, enum: FLOW_STEPS, default: "" },

        /**
         * Track when we entered current flowStep.
         * This is what reminders/expiry will use.
         */
        flowStepSetAt: Date,

        reconChoice: { type: String, enum: ["", "yes", "no", "reschedule", "cancel"], default: "" },
        reconChoiceAt: Date,

        reschedulePref: { type: String, default: "" },
        reschedulePrefAt: Date,

        readinessWindowKey: {
            type: String,
            enum: ["", "PROCEED_NOW", "LATER_TODAY", "TOMORROW", "CUSTOM"],
            default: "",
        },
        readinessWindowLabel: { type: String, default: "" },
        readinessWindowAt: Date,

        customCallWindowLabel: { type: String, default: "" },
        customCallWindowAt: Date,

        budgetRange: { type: String, default: "" },
        budgetRangeAt: Date,

        timeline: { type: String, default: "" },
        timelineAt: Date,

        decisionAuthority: { type: String, default: "" },
        decisionAuthorityAt: Date,

        completedAt: Date,

        /**
         * ✅ Expiry guard:
         * If user replies after many days, we stop and do not continue old flow.
         */
        expiredAt: Date,
        expiredReason: { type: String, default: "" },

        /**
         * ✅ Idempotency + audit
         */
        lastInboundAt: Date,
        lastInboundText: { type: String, default: "" },
        lastInboundType: { type: String, default: "" },
        lastInboundMessageId: { type: String, default: "" },

        lastInboundFingerprint: { type: String, default: "" },
        lastInboundFingerprintAt: Date,

        lastWebhookRaw: mongoose.Schema.Types.Mixed,

        lastOutboundAt: Date,
        lastOutboundTemplate: { type: String, default: "" },

        /**
         * ✅ Step sending markers + reminders
         */
        stepSentAt: { type: StepSentAtSchema, default: {} },
        stepReminders: {
            confirm: { type: StepReminderSchema, default: {} },
            paused: { type: StepReminderSchema, default: {} },
            reschedule: { type: StepReminderSchema, default: {} },
            readiness: { type: StepReminderSchema, default: {} },
            custom_time: { type: StepReminderSchema, default: {} },
            budget: { type: StepReminderSchema, default: {} },
            timeline: { type: StepReminderSchema, default: {} },
            decision: { type: StepReminderSchema, default: {} },
            summary: { type: StepReminderSchema, default: {} },
        },
    },
    { _id: false }
);

const SiteVisitSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        siteKey: { type: String },
        bookingRef: { type: String, index: true },

        address: { type: String, default: "" },
        coords: { type: CoordsSchema },

        when: { type: Date, required: true },

        triageStatus: { type: String, default: "pending", index: true },
        triageNote: { type: String, default: "" },
        needsTriage: { type: Boolean, default: true, index: true },

        leadType: { type: String, default: "existing", index: true },

        bookingMeta: { type: BookingMetaSchema, default: {} },

        status: { type: String, default: "scheduled", index: true },

        notify: { type: NotifySchema, default: {} },

        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "vendor-users" },

        notes: { type: String, default: "" },

        vendorInputs: { type: Object, default: {} },

        report: ReportSchema,
    },
    { timestamps: true }
);

SiteVisitSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("SiteVisit", SiteVisitSchema);
