import express from "express";
import {
    verifyVendorBank,
    rejectVendorBank,
} from "../controllers/AdminVendorController.js";

const router = express.Router();

router.patch(
    "/vendor/:vendorId/bank/verify",
    verifyVendorBank
);

router.patch(
    "/vendor/:vendorId/bank/reject",
    rejectVendorBank
);

export default router;
