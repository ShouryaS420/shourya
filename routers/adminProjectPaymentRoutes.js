// routers/adminProjectPaymentRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import ProjectDetails from "../models/ProjectDetails.js";
import User from "../models/User.js";
import EmailEvent from "../models/EmailEvent.js";
import { newId } from "../utils/id.js";
import { sendmail } from "../utils/sendmail.js";
import { requireCRM } from "../middleware/auth.js"; // or requireAdminAuth…

const router = express.Router();

// Simple disk storage for payment proofs
const PROOFS_DIR = path.join(process.cwd(), "uploads", "payment-proofs");
if (!fs.existsSync(PROOFS_DIR)) {
    fs.mkdirSync(PROOFS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PROOFS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || "";
        cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    },
});

const upload = multer({ storage });

router.post(
    "/admin/projects/:projectId/payment-stages/:stageKey/mark-paid",
    // requireCRM, // or your admin guard
    upload.array("files", 5),
    async (req, res) => {
        try {
            const { projectId, stageKey } = req.params;
            const {
                amount,
                paidOn,
                paymentMethod,
                paymentReference,
                paymentNotes,
            } = req.body;

            const project = await ProjectDetails.findById(projectId).populate("clientId");
            if (!project) {
                return res.status(404).json({ ok: false, message: "Project not found" });
            }

            const stage = (project.paymentSchedule || []).find((s) => s.key === stageKey);
            if (!stage) {
                return res
                    .status(404)
                    .json({ ok: false, message: "Payment stage not found" });
            }

            const amt = Number(amount || 0);

            // Attach files as proofs
            const proofs = (req.files || []).map((f) => ({
                filename: f.originalname,
                url: `/uploads/payment-proofs/${path.basename(f.path)}`,
                uploadedAt: new Date(),
            }));

            // Update stage fields
            stage.paidAmount = amt;
            stage.paidOn = paidOn ? new Date(paidOn) : new Date();
            stage.paymentMethod = paymentMethod || "bank_transfer";
            stage.paymentReference = paymentReference || "";
            stage.paymentNotes = paymentNotes || "";

            stage.paymentProofs = [...(stage.paymentProofs || []), ...proofs];

            stage.status = "paid";
            stage.markedPaidBy = req.user?._id || null;
            stage.markedPaidAt = new Date();

            project.markModified("paymentSchedule");
            await project.save();

            // Optional: send "payment received" email
            const client = project.clientId;
            if (client && client.email) {
                const subject = `Payment received – ${stage.label || "stage"} for your 99Squarewall project`;
                const html = `
          <p>Hi ${client.username || "Client"},</p>
          <p>
            We have received your payment of <strong>₹ ${amt.toLocaleString(
                    "en-IN",
                    { maximumFractionDigits: 0 }
                )}/-</strong> towards the stage
            <strong>"${stage.label || "Payment stage"}"</strong> for your project
            <strong>${project.projectTitle || project.projectName || ""}</strong>.
          </p>
          <p>Reference: ${paymentReference || "Not provided"}</p>
          <p>Thank you for the payment. Our team will continue with the scheduled work.</p>
          <p>Warm regards,<br/>99Squarewall Construction Team</p>
        `;

                await sendmail({
                    to: client.email,
                    subject,
                    html,
                });

                // await EmailEvent.create({
                //     trackingId: newId("em"),
                //     event: "payment_received",
                //     projectId: project._id,
                //     clientId: client._id,
                //     stageKey: stage.key,
                //     to: client.email,
                //     meta: {
                //         amount: amt,
                //         method: stage.paymentMethod,
                //         reference: stage.paymentReference,
                //     },
                // });
            }

            return res.json({
                ok: true,
                paymentSchedule: project.paymentSchedule,
            });
        } catch (err) {
            console.error("mark-paid error", err);
            return res
                .status(500)
                .json({ ok: false, message: "Failed to mark payment as paid" });
        }
    }
);

export default router;
