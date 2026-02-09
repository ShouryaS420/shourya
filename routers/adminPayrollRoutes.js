import express from "express";
import { getPayrollConfig, savePayrollConfig } from "../controllers/AdminPayrollConfigController.js";
import { updateWorkerPayrollProfile } from "../controllers/AdminWorkerPayrollController.js";
import { finalizeSettlement, listWorkerSettlements, listWorkerWorkDays, markSettlementPaid } from "../controllers/AdminPayrollController.js";

const router = express.Router();

router.get("/config", getPayrollConfig);
router.post("/config", savePayrollConfig);

router.post("/vendors/:id/payroll-profile", updateWorkerPayrollProfile);

// ✅ Day-to-day engine output
router.get("/worker/:workerId/workdays", listWorkerWorkDays);

// Weekly Settlements (admin)
router.get("/worker/:workerId/settlements", listWorkerSettlements);
router.post("/settlement/:id/finalize", finalizeSettlement);
router.post("/settlement/:id/mark-paid", markSettlementPaid);

export default router;
