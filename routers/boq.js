// routers/boq.js
import { Router, json, urlencoded } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createEstimate, listEstimates, getEstimate, updateStatus, emailEstimate, adminGetEstimate, approveEstimateAndCreateProject, adminGetProjectPayments, adminUpdateProjectPayments } from "../controllers/Estimate.js";
import { isAuthenticated } from "../middleware/auth.js";
import Estimate from "../models/Estimate.js";

const r = Router();

// ensure dir exists
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
const EST_DIR = path.join(process.cwd(), "uploads", "estimates");
ensureDir(EST_DIR);

// save PDFs as: <estimateId>-<timestamp>.pdf
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EST_DIR),
    filename: (req, file, cb) => {
        const id = req.params.id || req.body.estimateId || "unknown";
        const ts = Date.now();
        const safeName = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
        cb(null, `${safeName}-${ts}.pdf`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB hard cap
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") cb(null, true);
        else cb(new Error("Only PDF allowed"));
    },
});

// Save Quick/Custom estimate
r.post("/estimates", isAuthenticated, createEstimate);

// List & Get
r.get("/estimates", isAuthenticated, listEstimates);
r.get("/estimates/:id", isAuthenticated, getEstimate);

// Update status
r.put("/estimates/:id/status", isAuthenticated, updateStatus);

r.get("/admin/estimates/:id", adminGetEstimate);

r.post(
    "/:estimateId/approve",
    // isAuthenticated,
    // requireAuth,
    // requireCRM,
    approveEstimateAndCreateProject,
);

// Payment schedule admin endpoints
r.get(
    "/admin/projects/:projectId/payments",
    adminGetProjectPayments
);
r.put(
    "/admin/projects/:projectId/payments",
    adminUpdateProjectPayments
);

// 🔹 NEW: upload a PDF file (multipart) and get its URL back
r.post("/estimates/:id/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "file is required" });
        const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
        const publicUrl = `${base}/uploads/estimates/${req.file.filename}`;

        // optional: persist on the Estimate doc
        await Estimate.updateOne({ $or: [{ _id: req.params.id }], user: req.user._id },
            { $set: { pdfUrl: publicUrl, pdfUpdatedAt: new Date() } });

        return res.json({ success: true, url: publicUrl, filename: req.file.filename });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Upload failed" });
    }
});

// Email the estimate (accepts { fileUrl } or { pdfBase64 })
r.post(
    "/estimates/:id/email",
    isAuthenticated,
    json({ limit: "25mb" }),
    urlencoded({ extended: true, limit: "25mb" }),
    emailEstimate
);

export default r;
