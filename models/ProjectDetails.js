// Importing modules using ES6 import syntax
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

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

const constructionDetailsSchema = new Schema({
    finalPackageCost: { type: String, },
    selectedPackage: { type: String, },
    totalPackageCost: { type: String, },
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
    meetingStarted: { type: Boolean, default: false },
    requested: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    resubmit: { type: Boolean, default: false },
    stage: { type: String },
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

const PROJECT_STATUS = [
    "estimate_pending",   // (optional) before mapping estimate -> project
    "agreement_pending",  // estimate approved, but agreement mail not sent yet
    "agreement_sent",     // agreement email with link sent
    "agreement_accepted", // client clicked, agreed & submitted
    "project_started",    // final state after signed PDF is generated
];

const agreementSchema = new Schema(
    {
        token: { type: String, index: true },      // unique per project agreement
        initialPdfUrl: String,                     // optional: estimate/agreement draft PDF
        sentAt: Date,                              // when email with CTA was sent
        acceptedAt: Date,                          // when client signed
        signedPdfUrl: String,                      // final signed PDF (uploaded)
        signedByName: String,
        signedByEmail: String,
        signedFromIp: String,
        acceptedFromUserAgent: String,
    },
    { _id: false }
);

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

        // 🔹 NEW: reminder tracking fields
        reminderMilestonesSent: {
            type: [String],        // e.g. ["T-7", "T", "T+3"]
            default: [],
        },
        reminderDisabled: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

const projectUpdateSchema = new Schema(
    {
        date: { type: Date, default: Date.now },
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        progressPercent: { type: Number, default: 0 },
        photos: { type: [String], default: [] }, // store image URLs
        tags: { type: [String], default: [] },   // e.g. ["RCC", "Finishing"]
    },
    { _id: true }
);

const specMaterialSchema = new Schema(
    {
        title: { type: String, required: true },          // e.g. "Reinforcement Steel"
        icon: { type: String, default: "" },              // emoji or icon key
        lines: [
            {
                k: { type: String, required: true },      // label
                v: { type: String, required: true },      // value
            },
        ],
        chips: { type: [String], default: [] },
        order: { type: Number, default: 0 },              // for sequence control
    },
    { _id: false }
);

const specExecutionStepSchema = new Schema(
    {
        step: { type: Number, required: true },
        title: { type: String, required: true },
        overview: { type: String, required: true },
        notes: { type: [String], default: [] },
    },
    { _id: false }
);

const specBoardSchema = new Schema(
    {
        keySpecs: [
            {
                label: { type: String, required: true },
                value: { type: String, required: true },
            },
        ],

        materials: { type: [specMaterialSchema], default: [] },

        executionFlow: { type: [specExecutionStepSchema], default: [] },

        transparency: { type: [String], default: [] },

        lastUpdatedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const updatesStageSchema = new Schema(
    {
        stage: { type: String, required: true }, // Excavation, PCC, RCC, etc.

        status: {
            type: String,
            enum: ["completed", "ongoing", "upcoming"],
            default: "upcoming",
        },

        date: { type: Date },

        progress: { type: Number, min: 0, max: 100, default: 0 },

        description: { type: String, default: "" },

        videos: { type: [String], default: [] }, // vertical videos
    },
    { _id: false }
);

const updatesBoardSchema = new Schema(
    {
        stages: { type: [updatesStageSchema], default: [] },
        lastUpdatedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const projectSchema = new Schema({
    projectId: { type: String, required: true },
    clientName: { type: String, default: "" },
    clientEmail: { type: String, default: "" },
    clientMobile: { type: String, default: "" },
    clientCity: { type: String, default: "" },
    projectType: { type: String, default: "" },
    plotInformation: {
        areaOfPlot: { type: String, },
        length: { type: String },
        breadth: { type: String },
        plotLocation: { type: String }
    },
    specifications: {
        startDate: { type: Date, },
        endDate: { type: Date },
        details: { type: String },
        estimatedCost: { type: Number }
    },
    offers: [{
        offerType: { type: String },
        offerDetails: { type: String },
        validUntil: { type: Date }
    }],
    status: {
        type: String,
        default: 'New Leads',
    },
    leadStatus: { type: String, default: "New Leads", index: true },
    budgetRange: {
        min: { type: Number, default: "" },
        max: { type: Number, default: "" }
    },
    leadSource: { type: String, default: "" },
    leadType: { type: String, default: "" },
    loanApproved: { type: String, default: "" },
    financialStatus: { type: String, default: "" },
    isApproved: { type: Boolean, default: false },
    decisionMaker: { type: String, default: "" },
    timeframeToBuy: { type: String, default: "" },
    startProject: { type: Boolean, default: false },
    isSiteVisit: { type: Boolean, default: false },
    isDesignConsultation: { type: Boolean, default: false }, // add
    twoDDesigns: [designArray],
    threeDDesigns: [designArray],
    paymentSchedule: { type: [paymentScheduleSchema], default: [] },
    currentPhase: { type: String, default: '-' },
    progress: { type: String, default: '0%' },
    steps: [stepSchema],
    newlyAdded: { type: String, default: 'false' },
    yetToClose: { type: String, default: 'false' },
    ongoing: { type: String, default: 'false' },
    onHold: { type: String, default: 'false' },
    completed: { type: String, default: 'false' },
    tokenAmount: { type: Number },
    approvalDate: { type: Date },
    constructionDetails: [constructionDetailsSchema],
    isSendContactSign: { type: Boolean, default: false },
    isInitialPaymentReceived: { type: Boolean, default: false },
    activityLogs: [{
        // human title (e.g., "Site Visit Scheduled", "Quotation Shared")
        name: { type: String, default: "" },
        // one-line detail
        description: { type: String, default: "" },
        // machine type for UI icons/filters (e.g., "site_visit.scheduled")
        type: { type: String, default: "" },
        // who performed this
        actor: {
            id: { type: String, default: "" },
            name: { type: String, default: "" },
            role: { type: String, default: "" },
            avatarUrl: { type: String, default: "" },
            actorType: { type: String, default: "employee" }, // employee|client|system
        },
        // extra optional fields go here if you ever need them
        meta: { type: Object, default: {} },
        date: { type: Date, default: Date.now },
    }],
    siteVisitReportDetails: {
        assignedExpert: { type: String },
        meetingDetails: { type: String },
        isReady: { type: Boolean, default: false },
        status: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
        clientAttendance: { type: String, },
        sitePhotos: { type: [String], },
        terrainCondition: { type: String, },
        excavationStatus: { type: String, },
        waterElectricity: { type: String, },
        neighboringConditions: { type: String, },
        surroundingObstacles: { type: String, },
        accessToSite: { type: String, },
        clientInterestLevel: { type: String, },
        gpsLocation: {
            latitude: { type: String, default: "" },  // Set default to null
            longitude: { type: String, default: "" }  // Set default to null
        },
        additionalNotes: { type: String },
        visitCompleted: { type: Boolean, default: false }
    },

    designConsultationReport: { // add
        callConnected: { type: String, default: "" },
        meetingType: { type: String, default: "" },
        meetingDate: { type: String, default: "" },
        meetingTime: { type: String, default: "" },
        assignedExpert: { type: String, default: "" },
    }, // add

    // assignedTeamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'vendor-users' }],
    // assignedDepartments: [{ type: String, enum: ['Sales', 'Design', 'Construction', 'Finance', 'Legal', 'Field Operations', 'Customer Support'] }],

    assignedTeamMember: [{
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'vendor-users' },
        department: [{ type: String, enum: ['Sales', 'Design', 'Construction', 'Finance', 'Legal', 'Field Operations', 'Customer Support'], default: [] }],
        assignedWork: { type: String, default: "" },
    }],

    assignedTasks: [{
        taskName: { type: String, required: true },
        assignedTo: { type: String, },
        assignedDate: { type: Date, default: Date.now },
        status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' }
    }],

    taskProgress: [{
        stageName: { type: String, },
        progress: { type: String, },
        tasks: [
            { taskName: { type: String, }, "status": { type: String, } },
            { taskName: { type: String, }, "status": { type: String, } },
            { taskName: { type: String, }, "status": { type: String, } }
        ]
    }],

    clientId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    // 🔹 Account owner / RM handling this project
    rmId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
    },
    estimateId: { type: Schema.Types.ObjectId, ref: "Estimate", index: true, default: null },

    // 🔹 Basic project info (adapt these to what you already use)
    projectTitle: { type: String }, // e.g. "G+3 Bungalow at Pimple Nilakh"
    siteAddress: { type: String },
    city: { type: String },
    state: { type: String },

    // Total contract value we’ll use in agreement
    contractValue: { type: Number }, // e.g. 11749800

    // 🔹 Main project state
    status: {
        type: String,
        enum: PROJECT_STATUS,
        default: "agreement_pending",
        index: true,
    },

    projectWorkflowStatus: {
        type: String,
        enum: PROJECT_STATUS,
        default: "agreement_pending",
        index: true,
    },

    wizard: {
        currentStep: { type: Number, default: 1 },
        completed: { type: Boolean, default: false }
    },
    isDraft: { type: Boolean, default: true, index: true },

    stakeholders: {
        ownerName: { type: String, default: "" },
        ownerMobile: { type: String, default: "" },
        ownerEmail: { type: String, default: "" },

        architectName: { type: String, default: "" },
        structuralEngineerName: { type: String, default: "" },
        consultantName: { type: String, default: "" }
    },

    quotation: {
        version: { type: Number, default: 1 },
        quotationType: { type: String, default: "" }, // Turnkey / Labour / Item-rate

        // stores compileQuotationDetails() payload from QuotationBuilder
        details: { type: Schema.Types.Mixed, default: null },

        summary: {
            totalBuiltUpArea: { type: Number, default: 0 },
            baseCost: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
            finalCost: { type: Number, default: 0 },
        },

        lastUpdatedAt: { type: Date, default: null },
    },

    boardAccess: {
        enabled: { type: Boolean, default: false },

        specToken: { type: String, index: true, unique: true, sparse: true },
        updatesToken: { type: String, index: true, unique: true, sparse: true },

        visibility: {
            type: String,
            enum: ["qr_only", "public_summary", "otp_required"],
            default: "qr_only"
        },

        showOwnerPublicly: { type: Boolean, default: true }
    },

    boardProfile: {
        projectDisplayName: String,
        contractorName: {
            type: String,
            default: "Towardsnorth Global Projects Pvt. Ltd."
        },
        safetyNote: String,
        qualityNote: String
    },

    // 🔹 Public Spec Board (UI: SpecBoard.jsx)
    specBoard: { type: specBoardSchema, default: {} },

    // 🔹 Public Updates Board (UI: UpdatesBoard.jsx)
    updatesBoard: { type: updatesBoardSchema, default: {} },

    // inside projectSchema fields:
    updates: { type: [projectUpdateSchema], default: [] },

    // 🔹 Agreement workflow data
    agreement: agreementSchema,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

projectSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

// Exporting using ES6 export syntax
export default model('project-details', projectSchema);
