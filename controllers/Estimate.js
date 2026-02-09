// controllers/Estimate.js
import axios from "axios";
import Estimate from "../models/Estimate.js";
import { sendMailWithAttachments } from "../utils/sendmailWithAttachments.js";
import fs from "fs";
import path from "path";
import EmailEvent from "../models/EmailEvent.js";
import { newId } from "../utils/id.js";
import ProjectDetails from "../models/ProjectDetails.js";
import crypto from "crypto";
import User from "../models/User.js";
import SiteVisit from "../models/SiteVisit.js";
import { sendmail } from "../utils/sendmail.js";

/** City/package base rates (mirror your QuickEstimator constants) */
const PUNE_PRESETS = {
    economy: 1550,
    standard: 1850,
    luxury: 2250,
    royal: 2650,
};
const PLINTH_RATE_BY_PACKAGE = { economy: 1050, standard: 1150, luxury: 1250, royal: 1350 };

/** Server-side price calc — authoritative */
function calcPresetTotal({ perFt2, areaFt2, plinthAreaFt2 = 0, plinthRate = 0, headRoomAreaFt2 = 0, headRoomRate = 0 }) {
    const A = Math.max(0, Math.round(+areaFt2 || 0));
    const R = Math.max(0, Math.round(+perFt2 || 0));
    const P = Math.max(0, Math.round(+plinthAreaFt2 || 0));
    const PR = Math.max(0, Math.round(+plinthRate || 0));
    const H = Math.max(0, Math.round(+headRoomAreaFt2 || 0));
    const HR = Math.max(0, Math.round(+headRoomRate || R));

    const base = A * R;
    const plinthAmt = P * PR;
    const headAmt = H * HR;
    const total = Math.max(0, Math.round(base + plinthAmt + headAmt));
    return { perFt2: R, base, plinthAmt, headAmt, total };
}

const storeyLabel = (baseLevel, floorsAbove) => {
    const n = Math.max(0, parseInt(floorsAbove ?? 0, 10) || 0);
    return baseLevel === "P" ? `P+${n}` : `G+${n}`;
};

function buildDynamicPaymentSchedule({ contractValue = 0, estimate = null, client = null }) {
    const total = Math.max(0, Number(
        contractValue ||
        estimate?.pricing?.total ||
        0
    ));
    if (!total) return [];

    const preset = estimate?.recommendation?.selectedPreset || "standard";
    const floorsAbove = parseInt(estimate?.floorsAbove ?? 0, 10) || 0;

    // How many RCC slab stages? (at least 1 even if G+0)
    const superstructureStages = Math.max(1, floorsAbove || 1);

    // ---------- BASE PERCENTAGES (sum ≈ 100%) ----------
    const percentages = {
        booking: 10,          // at Agreement
        preConstruction: 5,   // soil test, survey, approvals
        plinth: 10,           // excavation + plinth
        superstructurePool: 35, // split across slabs
        brickPlaster: 20,     // masonry + internal plaster
        finishing: 15,        // flooring, doors, painting, MEP finishes
        handover: 5,          // final handover
    };

    // 👉 For smaller projects (< 25L): fewer early stages, push a bit more to plinth
    if (total < 2_500_000) {
        percentages.preConstruction = 0;
        percentages.booking = 12;
        percentages.plinth = 13;
        percentages.superstructurePool = 35;
        percentages.brickPlaster = 20;
        percentages.finishing = 15;
        percentages.handover = 5;
    }

    // 👉 For premium packages (luxury / royal): more value in finishing stage
    if (["luxury", "royal"].includes(preset)) {
        percentages.finishing += 5;
        percentages.brickPlaster -= 5;
    }

    const stages = [];

    // ---- 1. Booking / Agreement ----
    stages.push({
        key: "booking",
        label: "Booking / Agreement",
        description: "Initial booking payment at the time of signing the construction agreement.",
        percentage: percentages.booking,
        dueEvent: "agreement_signed",
    });

    // ---- 2. Pre-construction readiness (optional for bigger projects) ----
    if (percentages.preConstruction > 0) {
        stages.push({
            key: "pre_construction",
            label: "Pre-construction Readiness",
            description: "Soil test, digital survey, plan finalisation & statutory approvals.",
            percentage: percentages.preConstruction,
            dueEvent: "pre_construction_ready",
        });
    }

    // ---- 3. Excavation + Plinth ----
    stages.push({
        key: "plinth",
        label: "Excavation & Plinth",
        description: "Excavation, footing, columns up to plinth & plinth beam / slab.",
        percentage: percentages.plinth,
        dueEvent: "plinth_completed",
    });

    // ---- 4. Superstructure (auto-split by floors) ----
    const superstructurePctPerStage = percentages.superstructurePool / superstructureStages;

    const floorLabel = (idx) => {
        if (idx === 0) return "Ground Floor RCC & Structure";
        if (idx === 1) return "First Floor RCC & Structure";
        if (idx === 2) return "Second Floor RCC & Structure";
        if (idx === 3) return "Third Floor RCC & Structure";
        return `Floor ${idx + 1} RCC & Structure`;
    };

    for (let i = 0; i < superstructureStages; i++) {
        stages.push({
            key: `superstructure_${i + 1}`,
            label: floorLabel(i),
            description: "RCC slab, beams, columns & main frame work for this floor.",
            percentage: superstructurePctPerStage,
            dueEvent: "superstructure_stage",
        });
    }

    // ---- 5. Brickwork & Plaster ----
    stages.push({
        key: "brickwork_plaster",
        label: "Brickwork & Plaster",
        description: "Internal & external masonry, internal plaster, basic external plaster.",
        percentage: percentages.brickPlaster,
        dueEvent: "brickwork_plaster_completed",
    });

    // ---- 6. Finishing & Services ----
    stages.push({
        key: "finishing",
        label: "Finishing & Services",
        description: "Flooring, doors & windows, railings, painting, electrical & plumbing fixtures.",
        percentage: percentages.finishing,
        dueEvent: "finishing_stage",
    });

    // ---- 7. Handover ----
    stages.push({
        key: "handover",
        label: "Handover & Snag Closure",
        description: "Final snag rectification, joint inspection & handover.",
        percentage: percentages.handover,
        dueEvent: "handover",
    });

    // ---------- Convert % → amounts + fix rounding ----------
    const nonZeroStages = stages.filter(s => s.percentage > 0);
    const lastIndex = stages.lastIndexOf(nonZeroStages[nonZeroStages.length - 1]);

    let running = 0;
    const schedule = stages.map((stage, idx) => {
        if (stage.percentage <= 0) {
            return {
                ...stage,
                amount: 0,
                status: "pending",
                paidAmount: 0,
                notes: "",
            };
        }

        let amt = Math.round((total * stage.percentage) / 100);

        // Push rounding diff into the last non-zero stage
        if (idx === lastIndex) {
            const diff = total - (running + amt);
            amt += diff;
        }

        running += amt;

        return {
            ...stage,
            amount: amt,
            status: "pending",
            paidAmount: 0,
            notes: "",
        };
    });

    return schedule;
}

// Helper: format INR (no decimals, with commas)
const formatINR = (n) => {
    const num = Number(n) || 0;
    return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

/** POST /api/boq/estimates — create */
export const createEstimate = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const {
            siteKey,
            source = "quick",
            // location
            location = {},
            projectType,
            units,
            baseLevel,
            floorsAbove,
            floorsAreas,
            builtUpTotalFt2,

            // geometry
            shape,
            rect,
            trapezoid,
            triangle,
            segments,

            // authority & design
            authority,
            designSelected,
            designFiles,

            // conditions
            soilType,
            terrain,
            neighbor,
            road,

            // recommendation from client (we will validate/resolve)
            recommendation = {},
        } = req.body || {};

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!siteKey) return res.status(400).json({ success: false, message: "siteKey is required" });

        const selectedPreset = recommendation?.selectedPreset || null;
        if (!selectedPreset) {
            return res.status(400).json({ success: false, message: "selectedPreset is required" });
        }

        // 🔒 Require a booked Site Visit before locking a Quick estimate
        // if (source === "quick" && siteKey) {
        //     const hasVisit = await SiteVisit.findOne({
        //         userId,
        //         siteKey,
        //         status: { $nin: ["cancelled"] },   // scheduled / confirmed / completed etc.
        //     }).lean();

        //     if (!hasVisit) {
        //         return res.status(409).json({
        //             success: false,
        //             code: "SITE_VISIT_REQUIRED",
        //             message:
        //                 "Please book a site visit and get a clarity report before locking this estimate.",
        //         });
        //     }
        // }

        // DUPLICATE GUARD: same user + same source(quick) + same siteKey + same preset
        const exists = await Estimate.findOne({
            user: userId,
            source,
            siteKey,
            "recommendation.selectedPreset": selectedPreset,
        }).lean();
        if (exists) {
            return res.status(409).json({
                success: false,
                message: "Preset already used for this site",
            });
        }

        // Resolve city base + derived pieces
        const city = recommendation?.city || location?.city || "Pune";
        const perFt2Base = PUNE_PRESETS[selectedPreset] || 0;

        // Effective areas from client (trust but verify)
        const areaFt2 = Number(recommendation?.areaFt2 || builtUpTotalFt2 || 0);
        const plinthAreaFt2 = Number(recommendation?.plinthAreaFt2 ?? 0);
        const headRoomAreaFt2 = Number(recommendation?.headRoomAreaFt2 ?? 0);

        const plinthRate = PLINTH_RATE_BY_PACKAGE[selectedPreset] || 0;
        const headRoomRate = perFt2Base;

        // Compute authoritative pricing
        const pricing = calcPresetTotal({
            perFt2: perFt2Base,
            areaFt2,
            plinthAreaFt2,
            plinthRate,
            headRoomAreaFt2,
            headRoomRate,
        });

        const doc = await Estimate.create({
            siteKey,
            user: userId,
            source,
            location: {
                displayName: location?.displayName || location?.fullAddress || "",
                fullAddress: location?.fullAddress || "",
                coords: location?.coords || {},
                city,
            },
            projectType,
            units,
            baseLevel,
            floorsAbove,
            floorsAreas,
            builtUpTotalFt2,

            shape,
            rect,
            trapezoid,
            triangle,
            segments,

            authority,
            designSelected,
            designFiles,

            soilType,
            terrain,
            neighbor: {
                left: neighbor?.left || "",
                back: neighbor?.back || "",
                right: neighbor?.right || "",
            },
            road,

            recommendation: {
                selectedPreset,
                areaFt2,
                city,
                perFt2Base,
                plinthAreaFt2,
                plinthRate,
                headRoomAreaFt2,
                headRoomRate,
            },

            pricing,

            title: `${storeyLabel(baseLevel, floorsAbove)} • ${location?.displayName || city}`,
            cityTag: city,
            status: "Pending",
        });

        return res.json({ success: true, estimate: doc });
    } catch (err) {
        console.error("createEstimate error", err);
        return next?.(err) ?? res.status(500).json({ success: false, message: "Server error" });
    }
};

/** GET /api/boq/estimates?userId=&limit= */
export const listEstimates = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { siteKey, source } = req.query || {};
        const q = { user: userId };
        if (siteKey) q.siteKey = siteKey;
        if (source) q.source = source;
        const data = await Estimate.find(q).sort({ createdAt: -1 }).lean();
        return res.json({ success: true, data });
    } catch (err) {
        return next?.(err) ?? res.status(500).json({ success: false, message: "Server error" });
    }
};

/** GET /api/boq/estimates/:id */
export const getEstimate = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { id } = req.params;
        const est = await Estimate.findOne({ _id: id, user: userId });
        if (!est) return res.status(404).json({ success: false, message: "Not found" });
        return res.json({ success: true, data: est });
    } catch (err) {
        return next?.(err) ?? res.status(500).json({ success: false, message: "Server error" });
    }
};

/** PUT /api/boq/estimates/:id/status */
export const updateStatus = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const { id } = req.params;
        const { status } = req.body || {};
        const allowed = ["Pending", "Connecting RM", "Meeting Scheduled", "Approved Proposal"];
        if (!allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
        const doc = await Estimate.findOneAndUpdate(
            { $or: [{ _id: id }, { humanId: id }] },
            { $set: { status } },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: "Not found" });
        return res.json({ success: true, estimate: doc });
    } catch (err) {
        console.error("updateStatus error", err);
        return next?.(err) ?? res.status(500).json({ success: false, message: "Server error" });
    }
};

export const emailEstimate = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { id } = req.params;
        const { to, cc, bcc, pdfBase64, fileName, subject, message, fileUrl } = req.body || {};
        if (!to) return res.status(400).json({ success: false, message: "`to` is required" });

        // Load estimate (ownership check)
        const est = await Estimate.findOne({ user: userId }).lean();
        if (!est) return res.status(404).json({ success: false, message: "Estimate not found" });

        const estCode = est.humanId || id;
        const estTitle = est.title || `${est.recommendation?.city || "City"} • ${est.projectType || "Project"}`;
        const totalInr = (est.pricing?.total || 0).toLocaleString("en-IN");
        const emailSubject = subject || `Quotation ${estCode} • ${estTitle}`;
        const safeFileName = fileName || `99Squarewall_Quotation_${estCode}.pdf`;

        // Simple, brand-safe HTML (mobile friendly)

        const trackingId = newId();
        // log "sent" upfront (optional, or after successful send)
        await EmailEvent.create({
            event: "sent",
            trackingId,
            to,
            estimateId: estCode,
            campaign: "estimate",
        });

        const BASE = `http://192.168.1.4:8080/api`;
        const pixelUrl = `${BASE}/t/o/${trackingId}.png`; // unique per email
        // Optional: wrap your CTA through click tracker:
        const ctaTarget = `mailto:connect@99squarewall.com?subject=Quotation%20${encodeURIComponent(estCode)}`;
        const trackedCta = `${BASE}/t/c/${trackingId}?u=${encodeURIComponent(ctaTarget)}`;

        const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f6f7ff; padding:24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">
                <tr>
                    <td style="background:#002CFA; padding:18px 22px;">
                    <div style="color:#fff; font-size:16px; font-weight:700;">99Squarewall</div>
                    <div style="color:#cfe0ff; font-size:12px; margin-top:2px;">Building Dreams • One Square at a Time!</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:22px;">
                    <div style="font-size:16px; font-weight:700; color:#111; margin-bottom:6px;">Your Quotation is Ready</div>
                    <div style="color:#333; font-size:14px; line-height:1.5; margin-bottom:14px;">
                        Thank you for considering 99Squarewall. Please find your detailed quotation attached.
                    </div>

                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; background:#F7F8FF; border:1px solid #ECECFE; border-radius:10px; margin-bottom:16px;">
                        <tr>
                        <td style="padding:12px 14px; font-size:14px;">
                            <div><b>Quotation:</b> ${estCode}</div>
                            <div><b>Project:</b> ${estTitle}</div>
                            <div><b>Total:</b> ₹ ${totalInr}/-</div>
                        </td>
                        </tr>
                    </table>

                    ${message ? `<div style="white-space:pre-wrap; font-size:14px; color:#333; margin-bottom:14px;">${String(message)}</div>` : ""}

                    <a href="${trackedCta}"
                        style="display:inline-block; background:#002CFA; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:700; font-size:13px;">
                        Reply to discuss next steps
                    </a>
                    <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;opacity:0;width:1px;height:1px" />
                    </td>
                </tr>
                <tr>
                    <td style="padding:16px 22px; color:#667; font-size:12px; border-top:1px solid #f0f2ff;">
                    connect@99squarewall.com • www.99squarewall.com
                    </td>
                </tr>
                </table>
            </div>
        `;

        // Build attachments from either fileUrl OR base64 (prefer fileUrl)
        let attachments = [];
        if (fileUrl) {
            let content;
            if (/^https?:\/\//i.test(fileUrl)) {
                // remote (e.g., your PUBLIC_BASE_URL). Stream as arraybuffer.
                const resp = await axios.get(fileUrl, { responseType: "arraybuffer", timeout: 30_000 });
                content = Buffer.from(resp.data);
            } else {
                // local absolute path (avoid path traversal)
                const abs = path.resolve(fileUrl);
                content = await fs.promises.readFile(abs);
            }
            attachments = [{ filename: safeFileName, content, contentType: "application/pdf" }];
        } else if (pdfBase64) {
            const base64 = String(pdfBase64).includes(",") ? String(pdfBase64).split(",").pop() : String(pdfBase64);
            if (base64.length > 18_000_000) {
                return res.status(413).json({ success: false, message: "PDF too large to email. Please upload & send by URL." });
            }
            attachments = [{ filename: safeFileName, content: Buffer.from(base64, "base64"), contentType: "application/pdf" }];
        } else {
            return res.status(400).json({ success: false, message: "Provide either fileUrl or pdfBase64" });
        }

        await sendMailWithAttachments({ to, cc, bcc, subject: emailSubject, html, attachments });

        return res.json({ success: true, message: "Email sent", estimateId: estCode });
    } catch (err) {
        console.error("emailEstimate error", err);
        return next?.(err) ?? res.status(500).json({ success: false, message: "Server error" });
    }
};

/** GET /api/boq/admin/estimates/:id
 *  Admin / CRM view – no user login required
 */
export const adminGetEstimate = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required" });
        }

        // Allow lookup by Mongo _id OR humanId (EST-00001)
        const est = await Estimate.findOne({
            $or: [
                { _id: id },
                { humanId: id },
            ],
        }).lean();

        if (!est) {
            return res.status(404).json({ success: false, message: "Estimate not found" });
        }

        return res.json({ success: true, data: est });
    } catch (err) {
        console.error("adminGetEstimate error", err);
        return next?.(err) ?? res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * Admin approves an estimate and creates a ProjectDetails row.
 *
 * URL:   POST /api/estimates/:estimateId/approve
 * Auth:  requireCRM (admin/CRM only)
 */
function buildPaymentScheduleForProject({ contractValue, estimate, client }) {
    const dynamic = buildDynamicPaymentSchedule({ contractValue, estimate, client });
    if (dynamic && dynamic.length) return dynamic;
    // fallback – should rarely fire
    return buildDefaultPaymentSchedule(contractValue);
}

// --- Helpers for admin payment schedule updates ---

function normalizeNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function recomputeAmountsFromPercentages(schedule, contractValue) {
    const total = normalizeNumber(contractValue, 0);
    if (!total) return schedule;

    const nonZero = schedule.filter((s) => normalizeNumber(s.percentage, 0) > 0);
    if (!nonZero.length) return schedule;

    const lastNonZero = nonZero[nonZero.length - 1];
    const lastIndex = schedule.lastIndexOf(lastNonZero);

    let running = 0;

    return schedule.map((stage, idx) => {
        const pct = normalizeNumber(stage.percentage, 0);
        if (!pct) {
            return {
                ...stage,
                amount: normalizeNumber(stage.amount, 0),
            };
        }

        let amt = Math.round((total * pct) / 100);

        if (idx === lastIndex) {
            const diff = total - (running + amt);
            amt += diff;
        }

        running += amt;

        return {
            ...stage,
            amount: amt,
        };
    });
}

/**
 * GET /api/admin/projects/:projectId/payments
 * Admin-only: fetch payment schedule for a project.
 */
export const adminGetProjectPayments = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            return res
                .status(400)
                .json({ success: false, message: "projectId is required" });
        }

        const project = await ProjectDetails.findById(projectId).lean();
        if (!project) {
            return res
                .status(404)
                .json({ success: false, message: "Project not found" });
        }

        return res.json({
            success: true,
            data: {
                projectId: project._id,
                contractValue: project.contractValue || 0,
                paymentSchedule: Array.isArray(project.paymentSchedule)
                    ? project.paymentSchedule
                    : [],
            },
        });
    } catch (err) {
        console.error("adminGetProjectPayments error", err);
        return next?.(err) ?? res.status(500).json({
            success: false,
            message: "Server error while fetching payment schedule",
        });
    }
};

/**
 * PUT /api/admin/projects/:projectId/payments
 * Admin-only: replace/update payment schedule for a project.
 * Body: { paymentSchedule: [...] }
 */
export const adminUpdateProjectPayments = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { paymentSchedule } = req.body || {};

        if (!projectId) {
            return res
                .status(400)
                .json({ success: false, message: "projectId is required" });
        }

        if (!Array.isArray(paymentSchedule)) {
            return res.status(400).json({
                success: false,
                message: "paymentSchedule must be an array",
            });
        }

        const project = await ProjectDetails.findById(projectId);
        if (!project) {
            return res
                .status(404)
                .json({ success: false, message: "Project not found" });
        }

        const existing = Array.isArray(project.paymentSchedule)
            ? project.paymentSchedule
            : [];
        const existingByKey = new Map(
            existing
                .filter((s) => s && s.key)
                .map((s) => [String(s.key), s])
        );

        // Normalize & merge with existing to preserve paid info
        let normalized = paymentSchedule.map((item, index) => {
            const key =
                (item.key && String(item.key).trim()) ||
                `stage_${index + 1}`;
            const prev = existingByKey.get(key) || {};

            const label =
                (item.label && String(item.label).trim()) ||
                prev.label ||
                `Stage ${index + 1}`;

            const description =
                item.description !== undefined
                    ? String(item.description || "")
                    : prev.description || "";

            const percentage =
                item.percentage !== undefined
                    ? normalizeNumber(item.percentage, 0)
                    : normalizeNumber(prev.percentage, 0);

            const amount =
                item.amount !== undefined
                    ? normalizeNumber(item.amount, 0)
                    : normalizeNumber(prev.amount, 0);

            const dueEvent =
                item.dueEvent !== undefined
                    ? String(item.dueEvent || "")
                    : prev.dueEvent || "";

            const dueDaysAfter =
                item.dueDaysAfter !== undefined
                    ? normalizeNumber(item.dueDaysAfter, 0)
                    : normalizeNumber(prev.dueDaysAfter, 0);

            const dueDate =
                item.dueDate !== undefined
                    ? item.dueDate
                        ? new Date(item.dueDate)
                        : undefined
                    : prev.dueDate;

            const status =
                item.status !== undefined
                    ? String(item.status || "pending")
                    : prev.status || "pending";

            const paidAmount =
                item.paidAmount !== undefined
                    ? normalizeNumber(item.paidAmount, 0)
                    : normalizeNumber(prev.paidAmount, 0);

            const paidAt =
                item.paidAt !== undefined
                    ? item.paidAt
                        ? new Date(item.paidAt)
                        : undefined
                    : prev.paidAt;

            const paymentMode =
                item.paymentMode !== undefined
                    ? String(item.paymentMode || "")
                    : prev.paymentMode || "";

            const transactionRef =
                item.transactionRef !== undefined
                    ? String(item.transactionRef || "")
                    : prev.transactionRef || "";

            const notes =
                item.notes !== undefined
                    ? String(item.notes || "")
                    : prev.notes || "";

            return {
                key,
                label,
                description,
                percentage,
                amount,
                dueEvent,
                dueDaysAfter,
                dueDate,
                status,
                paidAmount,
                paidAt,
                paymentMode,
                transactionRef,
                notes,
            };
        });

        // If all amounts are zero but percentages exist, recompute from contractValue
        const allZeroAmounts = normalized.every(
            (s) => !normalizeNumber(s.amount, 0)
        );
        const hasAnyPercentage = normalized.some(
            (s) => normalizeNumber(s.percentage, 0) > 0
        );

        if (
            allZeroAmounts &&
            hasAnyPercentage &&
            normalizeNumber(project.contractValue, 0) > 0
        ) {
            normalized = recomputeAmountsFromPercentages(
                normalized,
                project.contractValue
            );
        }

        project.paymentSchedule = normalized;
        project.markModified("paymentSchedule");
        await project.save();

        return res.json({
            success: true,
            message: "Payment schedule updated",
            data: {
                projectId: project._id,
                contractValue: project.contractValue || 0,
                paymentSchedule: project.paymentSchedule,
            },
        });
    } catch (err) {
        console.error("adminUpdateProjectPayments error", err);
        return next?.(err) ?? res.status(500).json({
            success: false,
            message: "Server error while updating payment schedule",
        });
    }
};

export const approveEstimateAndCreateProject = async (req, res) => {
    try {
        const { estimateId } = req.params;
        const adminUserId = req.user?._id; // optional: who approved

        // 1) Load estimate with user
        const estimate = await Estimate.findById(estimateId).populate("user");

        if (!estimate) {
            return res.status(404).json({ ok: false, message: "Estimate not found" });
        }

        const client = estimate.user;

        if (!client) {
            return res.status(400).json({
                ok: false,
                message: "Estimate has no linked user (client).",
            });
        }

        // 2) Guard: already approved?
        if (estimate.status === "approved" && estimate.linkedProjectId) {
            const existingProject = await ProjectDetails.findById(
                estimate.linkedProjectId
            );
            return res.status(200).json({
                ok: true,
                message: "Estimate already approved and project already created",
                estimate,
                project: existingProject,
            });
        }

        // 3) Optional guard: disallow approving rejected estimates
        if (estimate.status === "rejected") {
            return res.status(400).json({
                ok: false,
                message:
                    "Cannot approve a rejected estimate. Please create a new estimate.",
            });
        }

        // 4) Prepare base client + project info

        // Generate a projectId – you can change this format if you want
        const rawCode = estimate.humanId || estimate._id.toString();
        const safeCode = String(rawCode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const projectId = client.mainUserID;

        const plotInfo = client.plotInformation || {};
        const loc = estimate.location || {};

        const city =
            loc.city ||
            plotInfo.city ||
            estimate.recommendation?.city ||
            ""; // try best source
        const state = plotInfo.state || "";

        const clientName =
            client.username ||
            client.fullName ||
            client.name ||
            `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
            "Client";

        const clientEmail = client.email || "";
        const clientMobile = client.mobile || "";

        const projectType =
            estimate.projectType || client.projectType || "residential";

        const contractValue =
            estimate.pricing?.total ??
            estimate.totalAmount ??
            estimate.totalCost ??
            estimate.grandTotal ??
            0;

        const projectTitle =
            estimate.title ||
            estimate.projectTitle ||
            `${storeyLabel(estimate.baseLevel, estimate.floorsAbove)} • ${loc.displayName || city || "Project"
            }`;

        const siteAddress =
            loc.fullAddress || loc.displayName || plotInfo.plotLocation || "";

        // 5) Build payload matching project-details schema
        const projectPayload = {
            projectId,
            clientName,
            clientEmail,
            clientMobile,
            clientCity: city || "Pune",
            projectType,
            plotInformation: {
                areaOfPlot: plotInfo.areaOfPlot || "",
                length: plotInfo.length || "",
                breadth: plotInfo.breadth || "",
                plotLocation: plotInfo.plotLocation || siteAddress || "",
            },
            newlyAdded: "false",
            yetToClose: "false",
            ongoing: "false",
            onHold: "false",
            completed: "false",

            clientId: client._id,
            rmId: estimate.assignedRM || null,
            estimateId: estimate._id,

            projectTitle,
            siteAddress,
            city,
            state,
            contractValue,

            status: "agreement_pending",

            agreement: {
                token: crypto.randomUUID(),
                initialPdfUrl: estimate.pdfUrl || null,
                sentAt: null,
                acceptedAt: null,
                signedPdfUrl: null,
                signedByName: null,
                signedByEmail: null,
                signedFromIp: null,
                acceptedFromUserAgent: null,
            },

            paymentSchedule: [],       // 👈 NEW
            steps: [],
            constructionDetails: client.constructionDetails,
            activityLogs: [],
        };

        // 6) Create project
        const project = await ProjectDetails.create(projectPayload);

        // 7) Update estimate: mark as approved + link project
        estimate.status = "approved";
        estimate.linkedProjectId = project._id;
        await estimate.save();

        // 8) Update client (User) status + steps for Agreement stage
        try {
            const userDoc = client;
            userDoc.currentPhase = "Agreement & Booking Payment";
            userDoc.startProject = false;

            // nudge progress if still at 0
            if (!userDoc.progress || userDoc.progress === "0%") {
                userDoc.progress = "40%";
            }

            if (Array.isArray(userDoc.steps)) {
                const pkgIndex = userDoc.steps.findIndex(
                    (s) => s.title === "Package selection & customization"
                );
                const agrIndex = userDoc.steps.findIndex(
                    (s) => s.title === "Agreement & booking payment"
                );
                if (pkgIndex !== -1 && !userDoc.steps[pkgIndex].status) {
                    userDoc.steps[pkgIndex].status = "completed";
                }
                if (agrIndex !== -1) {
                    userDoc.steps[agrIndex].status = "ongoing-stage";
                }
            }

            // align any constructionDetails row linked to this estimate
            if (Array.isArray(userDoc.constructionDetails)) {
                const cd = userDoc.constructionDetails.find(
                    (c) =>
                        c.estimateId?.toString?.() === estimate._id.toString() ||
                        c.estimateHumanId === estimate.humanId
                );
                if (cd) {
                    cd.stage = "Agreement & Booking Payment";
                    cd.status = "agreement_pending";
                }
            }

            await userDoc.save();
        } catch (e) {
            console.warn(
                "approveEstimateAndCreateProject: failed to update user status",
                e
            );
        }

        return res.status(200).json({
            ok: true,
            message: "Estimate approved and project created (agreement_pending).",
            estimate,
            project,
        });
    } catch (err) {
        console.error("approveEstimateAndCreateProject error:", err);
        return res.status(500).json({
            ok: false,
            message: "Something went wrong while approving estimate.",
        });
    }
};

/**
 * GET /api/admin/projects/:projectId/payment-schedule
 * Admin-only: fetch contractValue + paymentSchedule for a project.
 * If no schedule exists yet, auto-generate from contractValue + estimate + client.
 */
export const adminGetProjectPaymentSchedule = async (req, res, next) => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            return res
                .status(400)
                .json({ ok: false, message: "projectId is required" });
        }

        const project = await ProjectDetails.findById(projectId);
        if (!project) {
            return res
                .status(404)
                .json({ ok: false, message: "Project not found" });
        }

        // Existing schedule if any
        let schedule = Array.isArray(project.paymentSchedule)
            ? project.paymentSchedule
            : [];

        // 👉 If no schedule yet, auto-generate from estimate + client + contractValue
        if (!schedule.length) {
            let contractValue = Number(project.contractValue || 0) || 0;

            let estimate = null;
            let client = null;

            if (project.estimateId) {
                estimate = await Estimate.findById(project.estimateId).lean();

                // Fallback: derive contract value from estimate if missing on project
                if (!contractValue && estimate) {
                    contractValue = Number(
                        estimate.pricing?.total ??
                        estimate.totalAmount ??
                        estimate.totalCost ??
                        estimate.grandTotal ??
                        0
                    ) || 0;
                }
            }

            if (project.clientId) {
                client = await User.findById(project.clientId).lean();
            }

            const base = buildPaymentScheduleForProject({
                contractValue,
                estimate,
                client,
            }) || [];

            // Normalise into the shape we use everywhere
            schedule = base.map((s, index) => ({
                key: s.key || s.stageKey || s.id || `stage_${index + 1}`,
                label: s.label || `Stage ${index + 1}`,
                description: s.description || "",
                percentage: Number(s.percentage || 0) || 0,
                amount: Number(s.amount || 0) || 0,
                dueEvent: s.dueEvent || "",
                dueDaysAfter: Number(s.dueDaysAfter || 0),
                // We let admin set these; our save endpoint enforces dueDate
                dueDate: null,
                status: s.status || "pending",
                notes: s.notes || "",
            }));

            project.paymentSchedule = schedule;
            project.markModified("paymentSchedule");
            await project.save();
        }

        return res.json({
            ok: true,
            projectId,
            contractValue: project.contractValue || 0,
            paymentSchedule: schedule,
        });
    } catch (err) {
        console.error("adminGetProjectPaymentSchedule error:", err);
        return next?.(err) ?? res.status(500).json({
            ok: false,
            message: "Server error",
        });
    }
};

/**
 * PUT /api/admin/projects/:projectId/payment-schedule
 * Admin-only: overwrite paymentSchedule for a project.
 * Preserves *paid* fields (paidAmount, paidAt, paymentMode, transactionRef)
 * for any stage with the same `key`.
 */
export const adminUpdateProjectPaymentSchedule = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            return res
                .status(400)
                .json({ ok: false, message: "projectId is required" });
        }

        const project = await ProjectDetails.findById(projectId);

        if (!project) {
            return res
                .status(404)
                .json({ ok: false, message: "Project not found" });
        }

        const incoming = req.body?.paymentSchedule;
        if (!Array.isArray(incoming)) {
            return res.status(400).json({
                ok: false,
                message: "paymentSchedule must be an array",
            });
        }

        // Normalize & sanitize input
        const normalized = incoming.map((s, index) => {
            const key =
                s.key ||
                s.stageKey ||
                s.id ||
                `stage_${index + 1}`;

            const percentage =
                s.percentage === "" || s.percentage === null
                    ? 0
                    : Number(s.percentage || 0);

            const amount =
                s.amount === "" || s.amount === null
                    ? 0
                    : Number(s.amount || 0);

            const status = s.status || "pending";

            return {
                key,
                label: s.label || s.stageTitle || `Stage ${index + 1}`,
                description: s.description || "",
                percentage: isNaN(percentage) ? 0 : percentage,
                amount: isNaN(amount) ? 0 : amount,
                dueEvent: s.dueEvent || "",
                dueDaysAfter: Number(s.dueDaysAfter || 0),
                dueDate: s.dueDate || null,
                status,
                notes: s.notes || "",
            };
        });

        // Optional: auto-calc amounts from percentages when contractValue exists
        const contractValue = Number(project.contractValue || 0);

        if (contractValue > 0) {
            const totalPercent = normalized.reduce(
                (sum, s) => sum + (Number(s.percentage || 0) || 0),
                0
            );

            // If total% is within a sane range (0-100), distribute amounts strictly by percentage
            if (totalPercent > 0 && totalPercent <= 100.001) {
                normalized.forEach((s) => {
                    const p = Number(s.percentage || 0) || 0;
                    s.amount = Math.round((contractValue * p) / 100);
                });
            }
        }

        // dueDate handling: store as Date object
        normalized.forEach((s) => {
            if (s.dueDate) {
                const d = new Date(s.dueDate);
                if (!isNaN(d.getTime())) {
                    s.dueDate = d;
                }
            }
        });

        // Save to project
        project.paymentSchedule = normalized;
        await project.save();

        // 🔹 NEW: Notify client that payment schedule has been created/updated
        try {
            if (project.clientId && normalized.length > 0) {
                const client = await User.findById(project.clientId).lean();

                if (client && client.email) {
                    const clientName =
                        client.username ||
                        client.fullName ||
                        client.name ||
                        `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
                        "Client";

                    const projectTitle =
                        project.projectTitle ||
                        project.projectName ||
                        "your 99Squarewall project";

                    const totalPercent = normalized.reduce(
                        (sum, s) => sum + (Number(s.percentage || 0) || 0),
                        0
                    );

                    const subject = `Your payment schedule is ready – ${projectTitle}`;

                    const stagesHtml = normalized
                        .map((s) => {
                            const percent = Number(s.percentage || 0) || 0;
                            const amountStr = formatINR(s.amount || 0);
                            const due =
                                s.dueDate
                                    ? new Date(s.dueDate).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    })
                                    : "To be decided";

                            return `
                                <tr>
                                  <td style="padding:6px 8px; font-size:13px; border-bottom:1px solid #EEF2FF;">
                                    <div style="font-weight:500; color:#111827;">${s.label}</div>
                                    ${s.description
                                    ? `<div style="color:#6b7280; font-size:12px; margin-top:2px;">${s.description}</div>`
                                    : ""
                                }
                                  </td>
                                  <td style="padding:6px 8px; font-size:13px; border-bottom:1px solid #EEF2FF; white-space:nowrap;">${percent}%</td>
                                  <td style="padding:6px 8px; font-size:13px; border-bottom:1px solid #EEF2FF; white-space:nowrap;">₹ ${amountStr}/-</td>
                                  <td style="padding:6px 8px; font-size:13px; border-bottom:1px solid #EEF2FF; white-space:nowrap;">${due}</td>
                                </tr>
                            `;
                        })
                        .join("");

                    const html = `
                      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f6f7ff; padding:24px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">
                          <tr>
                            <td style="background:#002CFA; padding:18px 22px;">
                              <div style="color:#fff; font-size:16px; font-weight:700;">99Squarewall</div>
                              <div style="color:#cfe0ff; font-size:12px; margin-top:2px;">Your construction project – clear, stage-wise payments.</div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:22px;">
                              <div style="font-size:15px; color:#111; margin-bottom:10px;">
                                Hi ${clientName},
                              </div>
                              <div style="color:#333; font-size:14px; line-height:1.6; margin-bottom:16px;">
                                We’ve created/updated the stage-wise payment schedule for your project
                                <strong>${projectTitle}</strong>.
                              </div>

                              <div style="color:#4b5563; font-size:13px; margin-bottom:8px;">
                                <strong>Contract value:</strong> ₹ ${formatINR(
                        project.contractValue || 0
                    )}/-<br/>
                                <strong>Total stages:</strong> ${normalized.length} &nbsp;|&nbsp;
                                <strong>Total %:</strong> ${totalPercent}%
                              </div>

                              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin-top:8px; background:#F7F8FF; border:1px solid #E5E7EB; border-radius:10px; overflow:hidden;">
                                <thead>
                                  <tr>
                                    <th align="left" style="padding:8px; font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em;">Stage</th>
                                    <th align="left" style="padding:8px; font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em;">%</th>
                                    <th align="left" style="padding:8px; font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em;">Amount</th>
                                    <th align="left" style="padding:8px; font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em;">Due date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${stagesHtml}
                                </tbody>
                              </table>

                              <div style="color:#4b5563; font-size:13px; line-height:1.6; margin-top:18px;">
                                You can view this schedule anytime in the <strong>Payments</strong> section of your
                                99Squarewall mobile app and track which stages are pending, due or paid.
                              </div>

                              <div style="color:#6b7280; font-size:12px; margin-top:16px;">
                                Warm regards,<br/>
                                <strong>99Squarewall Construction Team</strong><br/>
                                connect@99squarewall.com
                              </div>
                            </td>
                          </tr>
                        </table>
                      </div>
                    `;

                    await sendmail({
                        to: client.email,
                        subject,
                        html,
                    });

                    console.log("Payment schedule email sent to:", client.email);
                }
            }
        } catch (emailErr) {
            console.error(
                "adminUpdateProjectPaymentSchedule – email notify error:",
                emailErr
            );
            // We don't fail the API if email fails
        }

        return res.json({
            ok: true,
            projectId: project._id,
            contractValue: project.contractValue || 0,
            paymentSchedule: project.paymentSchedule || [],
        });
    } catch (err) {
        console.error("adminUpdateProjectPaymentSchedule error:", err);
        return res.status(500).json({
            ok: false,
            message: "Server error while updating payment schedule",
        });
    }
};
