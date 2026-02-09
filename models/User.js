import mongoose from 'mongoose';
import jwt from "jsonwebtoken";
const { Schema } = mongoose;

const subStepSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['completed', 'ongoing-stage', ''] },
}, { _id: false });  // _id set to false if you do not want MongoDB to automatically generate _id for sub-steps

const stepSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['completed', 'ongoing-stage', ''] }, // Enum to control status values
    subSteps: [subStepSchema]  // Embedding sub-steps using the defined schema
}, { _id: false }); // Optionally disable _id for steps if not required

const packageSchema = new Schema({
    packageName: { type: String, required: true },
    packagePrice: { type: String, required: true },
    price: { type: String, },
    categories: [{
        category: { type: String, required: true },
        details: [{
            heading: { type: String, required: true },
            description: [{ type: String, required: true }],
            additional: { type: String },
            specialConsideration: { type: String },
            material: { type: String },
            cost: { type: String },
            deliverables: [{ type: String }]
        }]
    }]
}, { timestamps: true });

const commentSchema = new Schema({
    designId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Design',
        required: true
    },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const constructionDetailsSchema = new Schema({
    finalPackageCost: { type: String, },
    totalPackageCost: { type: String, },
    selectedPackage: { type: String, },
    plotArea: { type: String, },
    plinthBuiltUpArea: { type: String, },
    parkingGroundArea: { type: String, },
    configuration: { type: String, },
    discountType: { type: String, },
    discountValue: { type: String, },
    isDiscountApplied: { type: String, },
    plinthHeight: { type: String, },
    configurationName: { type: String, },
    floors: { type: Array, },
    clientSatisfaction: { type: String, default: "" },
    modificationsNeeded: { type: String, default: "" },
    pricingConcerns: { type: String, default: "" },
    budgetFlexibility: { type: String, default: "" },
    clientRemarks: { type: String, default: "" },
    packageDetails: [packageSchema],

    // 🔗 NEW: link this row to a specific estimate/quotation
    estimateId: { type: String, default: "" },        // can be Estimate._id or humanId
    estimateHumanId: { type: String, default: "" },

    meetingStarted: { type: Boolean, default: false },
    requested: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    resubmit: { type: Boolean, default: false },
    approved: { type: Boolean, default: false }, // add
    finalApproved: { type: Boolean, default: false }, // add
    stage: { type: String, default: "" },
    status: {
        type: String,
        default: 'Pending',
    },
    callCompleted: { type: Boolean, default: false },
    meetingType: { type: String, enum: ["At Office", "At Home", "Virtual Meeting"], default: null },
    meetingDate: { type: Date, default: null },
    meetingTime: { type: String, default: null },
    assignedRM: { type: String, default: null },
}, { timestamps: true });

const designArray = new Schema({
    name: { type: String, },
    imagesArray: { type: Array, },
}, { timestamps: true });

const paymentScheduleSchema = new Schema(
    {
        key: { type: String, required: true }, // e.g. 'booking', 'plinth', 'slab_1', ...
        label: { type: String, required: true }, // e.g. 'Booking / Agreement'
        description: { type: String, default: "" },

        /** commercial data */
        percentage: { type: Number, default: 0 },   // % of contract value
        amount: { type: Number, default: 0 },       // computed = contractValue * percentage/100

        /** when is it due */
        dueEvent: { type: String, default: "" },    // e.g. 'agreement_signed', 'plinth_completed'
        dueDaysAfter: { type: Number, default: 0 }, // optional: e.g. 7 days after event
        dueDate: { type: Date },                    // if admin fixes a concrete date

        /** status & actual payment */
        status: {
            type: String,
            enum: ["pending", "due", "paid", "overdue", "waived"],
            default: "pending",
        },
        paidAmount: { type: Number, default: 0 },
        paidAt: { type: Date },
        paymentMode: { type: String, default: "" },      // UPI, bank transfer, etc.
        transactionRef: { type: String, default: "" },   // reference no. / UTR

        notes: { type: String, default: "" },
    },
    { _id: false }
);

const userSchema = new Schema({
    mainUserID: { type: String, default: "" },
    familyMemberID: { type: String, default: "" },
    userId: { type: String, },
    username: { type: String, },
    email: {
        type: String,
    },
    mobile: {
        type: String,
    },
    needsProfile: { type: Boolean, default: false },      // gate to force profile step once
    signupMethod: { type: String, enum: ['email', 'mobile'], default: null }, // how they first signed
    signupIdentifier: { type: String, default: null },    // lock prefilled field in client
    familyMember: { type: Boolean, default: false },
    startProject: { type: Boolean, default: false },
    twoDDesigns: [commentSchema], // Using commentSchema to include comments for each design
    threeDDesigns: [commentSchema],
    paymentSchedule: { type: [paymentScheduleSchema], default: [] },
    img: { type: String, default: "image" },
    alternateNumber: { type: String, default: "not-set" },
    projectType: { type: String, },
    isSendContactSign: { type: Boolean, default: false },
    isInitialPaymentReceived: { type: Boolean, default: false },
    plotInformation: {
        areaOfPlot: { type: String },
        length: { type: String },
        breadth: { type: String },
        // human-friendly label you show in UI
        plotLocation: { type: String },
        // structured from Google Places
        placeId: { type: String },
        formattedAddress: { type: String },
        lat: { type: Number },
        lng: { type: Number },
        city: { type: String },
        district: { type: String },        // admin_level_2 (varies per country)
        state: { type: String },           // admin_level_1 long_name
        stateCode: { type: String },       // admin_level_1 short_name (e.g., MH)
        country: { type: String },
        countryCode: { type: String },     // ISO (e.g., IN)
        postalCode: { type: String },
        sublocality: { type: String },     // sublocality_level_1 (e.g., Kothrud)
        route: { type: String },           // street name
        streetNumber: { type: String },
        viewport: {
            northeast: { lat: { type: Number }, lng: { type: Number } },
            southwest: { lat: { type: Number }, lng: { type: Number } },
        },
        plusCode: { type: String },
        raw: { type: mongoose.Schema.Types.Mixed },              // optional: store full details for diagnostics
    },
    currentPhase: { type: String, default: '-' },
    progress: { type: String, default: '0%' },
    steps: [stepSchema],
    isApproved: { type: Boolean, default: false },
    assignedTeamMember: [{
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'vendor-users' },
        department: { type: String, default: "" },
        assignedWork: { type: String, default: "" },
    }],
    constructionDetails: [constructionDetailsSchema],
    otp: String,
    otpExpiresAt: Date,
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.methods.getJWTToken = function () {
    return jwt.sign({ _id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
    })
}

export default mongoose.model('User', userSchema);
