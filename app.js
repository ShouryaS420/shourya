import express from "express";
import projectDetails from './routers/projectDetails.js';
import user from './routers/user.js';
import familyMember from './routers/familyMember.js';
import raiseTicket from './routers/raiseTicket.js';
import uploadRoutes from './routers/uploadRoutes.js';
import designRoutes from './routers/designRoutes.js';
import vendorRoutes from './routers/vendorRoutes.js';
import adminPayrollRoutes from "./routers/adminPayrollRoutes.js";
import vendorApprovalRoutes from "./routers/vendorApprovalRoutes.js";
import adminAttendanceRoutes from "./routers/adminAttendanceRoutes.js";
import adminLeadershipProgramRoutes from "./routers/adminLeadershipProgramRoutes.js";
import vendorLeadershipProgramRoutes from "./routers/vendorLeadershipProgramRoutes.js";
import activitiesRouter from './routers/activities.js';
import adminAuthRouter from './routers/adminAuth/index.js';
import { adminAuthConfig } from './config/adminAuthConfig.js';
import boqRoutes from "./routers/boq.js";
import siteVisitRoutes from "./routers/siteVisitRoutes.js";
import adminSiteVisitsRouter from "./routers/adminSiteVisits.js";
import siteVisitPdfRoutes from "./routers/SiteVisitPdfRoutes.js";
import trackingRouter from "./routers/tracking.js";
import emailEventsRouter from "./routers/emailEvents.js";
import referralRoutes from "./routers/referralRoutes.js";
import adminProjectRoutes from "./routers/adminProjectRoutes.js";
import projectPaymentsRoutes from "./routers/projectPaymentsRoutes.js";
import adminProjectPaymentRoutes from "./routers/adminProjectPaymentRoutes.js";
import vendorAttendanceRoutes from "./routers/vendorAttendanceRoutes.js";
import careerRoutes from "./routers/careerRoutes.js";
import publicSiteVisitRoutes from "./routers/publicSiteVisitRoutes.js";
import webhookRoutes from "./routes/webhooks.js";
import whatsAppFlowRoutes from "./routers/whatsAppFlowRoutes.js";
import vendorLeadershipApplyRoutes from "./routers/vendorLeadershipApplyRoutes.js";
import systemLeadershipSelectionRoutes from "./routers/systemLeadershipSelectionRoutes.js";
import adminAttendanceLocations from "./routers/adminAttendanceLocations.js";

import adminLeadershipApplicationRoutes from "./routers/adminLeadershipApplicationRoutes.js";
import vendorLeadershipTeamRoutes from "./routers/vendorLeadershipTeamRoutes.js";
import vendorLeadershipExecutionRoutes from "./routers/vendorLeadershipExecutionRoutes.js";
import adminLeadershipVerificationRoutes from "./routers/adminLeadershipVerificationRoutes.js";
import adminLeadershipApprovalRoutes from "./routers/adminLeadershipApprovalRoutes.js";

import workerHomeRoutes from "./routes/workerHomeRoutes.js";
import adminBannerRoutes from "./routes/adminBannerRoutes.js";
import adminTranslateRoutes from "./routes/adminTranslateRoutes.js";
import adminRoutes from "./routers/adminRoutes.js";

import cookieParser from "cookie-parser";
import cors from "cors";

export const app = express();

const ALLOWED_ORIGINS = [
    adminAuthConfig.DASHBOARD_ORIGIN,
    "http://localhost:5173",
    "http://192.168.1.5:5173",
    "http://192.168.43.65:5173",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://trytowardsnorth.com",
    "https://www.trytowardsnorth.com",
    "https://towardsnorth.in",
    "https://www.towardsnorth.in",
].filter(Boolean);

app.use(express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
}));

// Use project routes
app.use('/api/projects', projectDetails);

// Use user routes
app.use('/api/user', user);

// Use familyMember routes
app.use('/api/familyMember', familyMember);

// Use raiseTicket routes
app.use('/api/raiseTicket', raiseTicket);

// Use upload images routes
app.use('/api/uploadImage', uploadRoutes);

// Designs
app.use('/api/designs', designRoutes);

// Vendor
app.use('/api/vendor', vendorRoutes);

app.use("/api/admin/payroll", adminPayrollRoutes);

app.use("/api/vendor/approval", vendorApprovalRoutes);

app.use("/api/admin/attendance", adminAttendanceLocations);

app.use("/api/vendor/attendance", vendorAttendanceRoutes);

app.use("/api/vendor/leadership", vendorLeadershipProgramRoutes);
app.use("/api/vendor/leadership", vendorLeadershipApplyRoutes);
app.use("/api/vendor/leadership", vendorLeadershipTeamRoutes);
app.use("/api/vendor/leadership", vendorLeadershipExecutionRoutes);

app.use("/api/system/leadership", systemLeadershipSelectionRoutes);

app.use("/api/admin/leadership", adminLeadershipProgramRoutes);
app.use("/api/admin/leadership", adminLeadershipApplicationRoutes);
app.use("/api/admin/leadership", adminLeadershipVerificationRoutes);
app.use("/api/admin/leadership", adminLeadershipApprovalRoutes);

app.use("/api", workerHomeRoutes);

app.use("/api", adminBannerRoutes);

app.use("/api", adminRoutes);

app.use("/api/career", careerRoutes);

app.use('/api/activities', activitiesRouter);

app.use('/api/admin-auth', adminAuthRouter);

app.use("/api/boq", boqRoutes);

app.use("/api/site-visits", siteVisitRoutes);

app.use("/api/admin", adminSiteVisitsRouter);

app.use("/api/site-visits", siteVisitPdfRoutes);

// public tracking endpoints
app.use("/t", trackingRouter);

app.use("/api/email/events", emailEventsRouter);

app.use("/api/referrals", referralRoutes);

app.use("/api/admin", adminProjectRoutes);

app.use("/api", projectPaymentsRoutes);

app.use("/api", adminProjectPaymentRoutes);

app.use("/api/public/site-visits", publicSiteVisitRoutes);

/**
 * Webhooks:
 * - Interakt webhook: /api/webhooks/interakt
 */
app.use("/api/webhooks", webhookRoutes);

/**
 * Existing WhatsApp Flow routes (if you still keep them)
 */
// app.use("/api/webhooks", whatsAppFlowRoutes);
