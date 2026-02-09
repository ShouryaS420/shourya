// routers/projectPaymentsRoutes.js (or inside your existing router)
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
    getMyPayments,
    emailNextPayment,
} from "../controllers/projectPayments.js";

const r = express.Router();

// GET: used by mobile app Payments.js
r.get("/projects/my/payments", requireAuth, getMyPayments);

// POST: used by Payments.js "Send payment email"
r.post("/projects/my/payments/email-next", requireAuth, emailNextPayment);

export default r;
