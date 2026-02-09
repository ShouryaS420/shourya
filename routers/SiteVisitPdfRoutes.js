// routes/SiteVisitPdfRoutes.js
import express from "express";
import { isAuthenticated } from "../middleware/auth.js";
import { generateVisitPdf } from "../controllers/PdfController.js";

const router = express.Router();
router.use(isAuthenticated);

// GET /api/site-visits/:id/pdf?download=1
router.get("/:id/pdf", generateVisitPdf);

export default router;
