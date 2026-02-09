// controllers/PdfController.js
import SiteVisit from "../models/SiteVisit.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { renderPdf } from "../services/pdf.js";
import { buildReportHtml } from "../services/reportHtml.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where to store PDFs locally (and serve statically)
const REPORTS_DIR = path.join(__dirname, "..", "uploads", "reports");

export async function generateVisitPdf(req, res) {
    try {
        const { id } = req.params;
        const { download } = req.query;

        // auth: user must own the visit OR be vendor/admin (your existing isAuthenticated already runs)
        const visit = await SiteVisit
            .findOne({ _id: id }) // optionally scope to req.user._id if this is the "self" route
            .populate("assignedTo", "username mobile role");

        if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

        // Build HTML
        const html = buildReportHtml(visit);

        // Prepare output path (optional)
        const fileName = `SVR-${String(visit._id).slice(-6).toUpperCase()}.pdf`;
        const filePath = path.join(REPORTS_DIR, fileName);

        // Render
        const pdfBuffer = await renderPdf(html, {
            filePath,             // also save to disk for later fetch
            marginTop: "70px",    // header 50px + breathing room
            marginBottom: "70px", // footer room
            printBackground: true
        });

        // Store pdfUrl on the visit (served from /uploads/reports)
        const pdfUrl = `/uploads/reports/${fileName}`;
        visit.report = {
            ...(visit.report || {}),
            pdfUrl,
        };
        await visit.save();

        // If ?download=1, set headers to download; otherwise inline preview
        const disposition = download ? "attachment" : "inline";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${disposition}; filename="${fileName}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error("PDF gen error", err);
        res.status(500).json({ success: false, message: err.message || "PDF generation failed" });
    }
}
