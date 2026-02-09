// routes/vendorApprovalRoutes.js
import express from "express";
import {
    approveVendor,
    rejectVendor,
    listVendorsByApprovalStatus,
    markVendorPending,
} from "../controllers/VendorApprovalController.js";

const router = express.Router();

// List by status
router.get("/vendors", listVendorsByApprovalStatus);

// Approve / Reject
router.patch("/:id/approve", approveVendor);
router.patch("/:id/reject", rejectVendor);

// Optional: set PENDING
router.patch("/:id/mark-pending", markVendorPending);

export default router;
