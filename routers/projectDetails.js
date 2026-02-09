// Importing express and controllers
import express from 'express';
import {
    acceptAgreement,
    approveProjects,
    approveSiteVisitByHigherAuthority,
    createProject,
    getMyPaymentSchedule,
    getProjects,
    getProjectsByAssignedMember,
    getProjectsById,
    handleApprovedRequestedQuotation,
    handleStartMeeting,
    previewAgreement,
    proceedVisit,
    quotationDetailsUpdate,
    saveMeetingOutcome,
    saveProposalApprovalMeeting,
    sendAgreementEmail,
    updateDesignConsultation,
    updateDesignConsultationStatus,
    updateIsSiteVisit,
    updateSiteVisitReadiness,
    wizardCreateProject,
    wizardUpdateBasic,
    wizardUpdateStakeholders,
    wizardUpdateQuotation,
    wizardUpdateBoard,
    publicGetSpecsByToken,
    publicGetUpdatesByToken,
    adminAddProjectUpdate,
    wizardUpdateSpecsBoard,
    wizardUpdateUpdatesBoard,
} from '../controllers/ProjectDetails.js';
import { isAuthenticated } from '../middleware/auth.js';
import { getMyProjectDetails } from '../controllers/ProjectClientView.js';

const router = express.Router();

// ✅ Wizard routes (draft-friendly)
router.post("/wizard/create", wizardCreateProject);
router.put("/wizard/:projectId/basic", wizardUpdateBasic);
router.put("/wizard/:projectId/stakeholders", wizardUpdateStakeholders);
router.put("/wizard/:projectId/quotation", wizardUpdateQuotation);
router.put("/wizard/:projectId/board", wizardUpdateBoard);

router.put("/wizard/:projectId/spec-board", wizardUpdateSpecsBoard);
router.put("/wizard/:projectId/updates-board", wizardUpdateUpdatesBoard);
router.get("/public/spec/:token", publicGetSpecsByToken);
router.get("/public/updates/:token", publicGetUpdatesByToken);

// admin
router.post("/:projectId/updates", adminAddProjectUpdate);

router.post('/createProject', createProject);

// Route to get all projects
router.get('/getProjects', getProjects);

// Route to get all projects
router.get('/getProjectsById/:id', getProjectsById);

// 🔹 New: client-side payment schedule for current logged-in user
router.get("/my/payments", isAuthenticated, getMyPaymentSchedule);

// 🔹 Client mobile view
router.get('/client/my-project', isAuthenticated, getMyProjectDetails);

// Route to get all projects
router.get('/getProjectsByAssignedMember/:id', getProjectsByAssignedMember);

// Route to approved user by id
router.patch('/approveProjects/:id', approveProjects);

// Route to update quotation details by id
router.patch('/quotationDetailsUpdate/:id', quotationDetailsUpdate);

// Route to update quotation details by id
router.patch('/handleApprovedRequestedQuotation/:userId/:constructionId', handleApprovedRequestedQuotation);

// Update Site Visit Readiness
router.put("/update-site-visit/:id", updateSiteVisitReadiness);

// Update Site Visit Readiness
router.post("/proceedVisit/:id/:taskId", proceedVisit);

// Update Site Visit Readiness
router.put("/approveSiteVisitByHigherAuthority/:id", approveSiteVisitByHigherAuthority);

// Update Site Visit Readiness
router.put("/updateIsSiteVisit/:id", updateIsSiteVisit);

// 🛤️ Route to update Design & Consultation Report
router.put("/design-consultation/:id", updateDesignConsultation);

// 🛤️ Route to update Design & Consultation Report
router.put("/updateStatusToProposal/:id", updateDesignConsultationStatus);


// GET /api/public/agreement/preview?token=...&projectId=...
router.get("/agreement/preview", previewAgreement);

// POST /api/public/agreement/accept
router.post("/agreement/accept", express.json(), acceptAgreement);

router.put("/saveProposalMeeting/:id", saveProposalApprovalMeeting);

router.put("/handleStartMeeting/:id", handleStartMeeting);

router.put("/saveMeetingOutcome/:id", saveMeetingOutcome);

// POST /api/projects/:projectId/send-agreement
router.post(
    "/:projectId/send-agreement",
    sendAgreementEmail
);

export default router;
