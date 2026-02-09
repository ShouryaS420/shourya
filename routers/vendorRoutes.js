// Importing express and controllers
import express from 'express';
import {
    createVendorUser,
    getMyProfile,
    getUsersById,
    getVendorUser,
    login,
    logout,
    verifyOtp,
} from '../controllers/VendorController.js';
import { isVendorAuthenticated } from '../middleware/vendorUserAuth.js';
import {
    getAssignedVisit, listMyAssignedVisits, saveVendorInputs, updateAssignedVisitStatus, upsertReport,
} from '../controllers/SiteVisitController.js';
import {
    updateProfile,
    updateSkills,
    updateCity,
    submitSelfie,
    submitAadhaar,
    submitPan,
    acceptConsent,
    submitOnboarding,
    me,
} from "../controllers/VendorOnboardingController.js";
import {
    getAttendanceLocations,
    getAttendanceStatus,
    checkInVendor,
    checkOutVendor,
} from "../controllers/VendorAttendanceController.js";
import { getMyPayrollHistory, getMyWeekPayroll } from '../controllers/VendorPayrollController.js';
import { getPocketSummary } from '../controllers/WorkerPocketController.js';
import {
    getCurrentWeekEarnings,
    getTodayEarnings,
    getCurrentMonthEarnings,
    getEarningsHistory,
    getHomeWeekSummary,
} from "../controllers/WorkerEarningsController.js";
import { getPreviousWeekPayout } from '../controllers/WorkerPayoutController.js';

import { getWorkerOffersFeed } from "../controllers/WorkerOffersController.js";
import { getMyProfileDetails, upsertMyBankDetails } from '../controllers/VendorProfileController.js';
import { getAboutApp, getFaqs, getPrivacyPolicy } from '../controllers/AppContentController.js';

const router = express.Router();

router.post('/createVendorUser', createVendorUser);

router.get('/getVendorUser', getVendorUser);

router.post('/login', login);

router.post('/verifyOtp', verifyOtp);

router.route("/logout").get(logout);

// router.route("/me").get(isVendorAuthenticated, getMyProfile);

router.post("/onboarding/profile", isVendorAuthenticated, updateProfile);
router.post("/onboarding/skills", isVendorAuthenticated, updateSkills);
router.post("/onboarding/city", isVendorAuthenticated, updateCity);
router.post("/onboarding/selfie", isVendorAuthenticated, submitSelfie);
router.post("/onboarding/aadhaar", isVendorAuthenticated, submitAadhaar);
router.post("/onboarding/pan", isVendorAuthenticated, submitPan);
router.post("/onboarding/consent", isVendorAuthenticated, acceptConsent);
router.post("/onboarding/submit", isVendorAuthenticated, submitOnboarding);

router.post('/getUsersById', getUsersById);

// Attendance (Vendor App)
router.get("/me", isVendorAuthenticated, me);
// router.get("/attendance/locations", getAttendanceLocations);
// router.get("/attendance/status", getAttendanceStatus);
// router.post("/attendance/check-in", checkInVendor);
// router.post("/attendance/check-out", checkOutVendor);
router.get("/attendance/locations", isVendorAuthenticated, getAttendanceLocations);
router.get("/attendance/status", isVendorAuthenticated, getAttendanceStatus);
router.post("/attendance/check-in", isVendorAuthenticated, checkInVendor);
router.post("/attendance/check-out", isVendorAuthenticated, checkOutVendor);

// All partner/field-exec routes require vendor auth
// router.use(isVendorAuthenticated);

// Visit listing for this vendor
router.get("/visits/mine", listMyAssignedVisits);

// Read one assigned visit
router.get("/visits/:id", getAssignedVisit);

// Update status (e.g., start → in_progress, submit → submitted_inputs)
router.patch("/visits/:id/status", updateAssignedVisitStatus);

// Add raw field inputs (reuse controller with vendor guard)
router.post("/visits/:id/inputs", saveVendorInputs);

// Submit draft report (verify=false from partner app)
router.post("/visits/:id/report", isVendorAuthenticated, upsertReport);

// Payroll / Pocket
router.get("/payout/week", isVendorAuthenticated, getMyWeekPayroll);
router.get("/payout/history", isVendorAuthenticated, getMyPayrollHistory);

router.get("/worker/pocket/summary", isVendorAuthenticated, getPocketSummary);

router.get("/worker/earnings/current-week", isVendorAuthenticated, getCurrentWeekEarnings);
router.get("/worker/earnings/today", isVendorAuthenticated, getTodayEarnings);
router.get("/worker/earnings/current-month", isVendorAuthenticated, getCurrentMonthEarnings);
router.get("/worker/earnings/history", isVendorAuthenticated, getEarningsHistory);

router.get("/worker/payout/previous-week", isVendorAuthenticated, getPreviousWeekPayout);

router.get("/worker/earnings/home-week", isVendorAuthenticated, getHomeWeekSummary);

// ✅ Profile details for app Profile screen
router.get("/me/profile", isVendorAuthenticated, getMyProfileDetails);

// ✅ Bank details submit/update (PENDING)
router.patch("/me/bank", isVendorAuthenticated, upsertMyBankDetails);

// ✅ Static content (served via backend + i18n)
router.get("/content/privacy-policy", isVendorAuthenticated, getPrivacyPolicy);
router.get("/content/about", isVendorAuthenticated, getAboutApp);
router.get("/content/faqs", isVendorAuthenticated, getFaqs);

export default router;