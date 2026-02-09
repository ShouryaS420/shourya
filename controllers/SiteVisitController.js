import SiteVisit from "../models/SiteVisit.js";
import VendorUsers from "../models/VendorUsers.js";
import { markSiteVisitStep, markSiteVisitProgress } from "../utils/steps.js";

// helper
const toBookingRef = (id) => String(id).slice(-6).toUpperCase();

/** POST /api/site-visits
 * body: { whenISO, address, coords:{lat,lng}, notes, siteKey }
 */
export async function createVisit(req, res) {
    try {
        const { whenISO, address, coords, notes, siteKey } = req.body || {};
        if (!whenISO) {
            return res
                .status(400)
                .json({ success: false, message: "whenISO required" });
        }

        const when = new Date(whenISO);
        if (Number.isNaN(+when)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid whenISO" });
        }

        // 🔒 One active visit per user + siteKey
        if (siteKey) {
            const existing = await SiteVisit.findOne({
                userId: req.user._id,
                siteKey,
                status: { $nin: ["cancelled"] },
            }).lean();

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message:
                        "You already have a site visit booked for this project.",
                    visit: existing,
                });
            }
        }

        const visit = await SiteVisit.create({
            userId: req.user._id,
            siteKey: siteKey || undefined,
            when,
            address: address || "",
            coords: coords || undefined,
            notes: notes || "",
            status: "scheduled",
        });

        visit.bookingRef = toBookingRef(visit._id);
        await visit.save();

        await markSiteVisitStep(req.user._id, "ongoing-stage");
        await markSiteVisitProgress(req.user._id, "booking_confirmed");

        res.json({ success: true, visit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

/** GET /api/site-visits (self) */
export async function listMyVisits(req, res) {
    try {
        const visits = await SiteVisit
            .find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate("assignedTo", "username mobile role");
        res.json({ success: true, visits });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

/** GET /api/site-visits/:id (self) */
export async function getMyVisit(req, res) {
    try {
        const { id } = req.params;
        const visit = await SiteVisit
            .findOne({ _id: id, userId: req.user._id })
            .populate("assignedTo", "username mobile role");
        if (!visit) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, visit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

/** PATCH /api/site-visits/:id
 * body: { address?, coords?, whenISO?, notes?, status? }
 */
export async function updateMyVisit(req, res) {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const visit = await SiteVisit.findOne({ _id: id, userId: req.user._id });
        if (!visit) return res.status(404).json({ success: false, message: "Not found" });

        if (body.address !== undefined) visit.address = body.address;
        if (body.coords !== undefined) visit.coords = body.coords;
        if (body.whenISO !== undefined) {
            const dt = new Date(body.whenISO);
            if (Number.isNaN(+dt)) return res.status(400).json({ success: false, message: "Invalid whenISO" });
            visit.when = dt;
            visit.status = "rescheduled";
            // Reflect in the user’s step progress
            await markSiteVisitProgress(visit.userId, "rescheduled");
        }
        if (body.notes !== undefined) visit.notes = body.notes;
        if (body.status) {
            visit.status = body.status;
            if (body.status === "cancelled") {
                await markSiteVisitProgress(visit.userId, "cancelled");
            } else if (body.status === "rescheduled") {
                await markSiteVisitProgress(visit.userId, "rescheduled");
            }
        }

        await visit.save();
        res.json({ success: true, visit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

/** POST /api/site-visits/:id/assign
 * body: { vendorUserId }
 * Admin/ops can call this; for now allow authenticated (you can tighten later).
 */
export async function assignVendor(req, res) {
    try {
        const { id } = req.params;
        const { vendorUserId } = req.body || {};
        if (!vendorUserId) return res.status(400).json({ success: false, message: "vendorUserId required" });

        const vendor = await VendorUsers.findById(vendorUserId);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor user not found" });

        const visit = await SiteVisit.findById(id);
        if (!visit) return res.status(404).json({ success: false, message: "Site visit not found" });

        visit.assignedTo = vendor._id;
        if (visit.status === "scheduled") visit.status = "confirmed";
        await visit.save();
        // Update user's progress
        await markSiteVisitProgress(visit.userId, "engineer_assigned");

        res.json({ success: true, visit });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/** POST /api/site-visits/:id/vendor-inputs
 * body: { inputs: {...} }  (mobile vendor app will post raw fieldwork)
 */
export async function saveVendorInputs(req, res) {
    try {
        const { id } = req.params;
        const { inputs } = req.body || {};
        // If called by vendor route (has req.vendor), enforce ownership:
        const query = req.vendor?._id ? { _id: id, assignedTo: req.vendor._id } : { _id: id };
        const visit = await SiteVisit.findOne(query);
        if (!visit) return res.status(404).json({ success: false, message: "Site visit not found" });

        // NOTE: in production you should restrict this to the assigned vendor user
        visit.vendorInputs = { ...(visit.vendorInputs || {}), ...(inputs || {}) };
        await visit.save();
        // If the assigned vendor starts saving inputs, mark inspection started
        if (req.vendor?._id && String(visit.assignedTo || "") === String(req.vendor._id || "")) {
            await markSiteVisitProgress(visit.userId, "inspection_started");
        }

        const populated = await SiteVisit.findById(visit._id)
            .populate("assignedTo", "username mobile role");
        res.json({ success: true, visit: populated });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/** POST /api/site-visits/:id/report
    * body: { summary, sections, photos, pdfUrl, verify } 
    * - If verify=true and caller is admin: mark verified & status=completed and update User.steps to "completed".
*/
export async function upsertReport(req, res) {
    try {
        const { id } = req.params;

        // Do NOT reassign these; keep as const from req.body
        const {
            summary,
            sections,
            photos,
            pdfUrl,
            verify,
        } = req.body || {};

        // Defensive normalization without reassigning consts
        const normSections = Array.isArray(sections) ? sections : [];
        const normPhotos = (Array.isArray(photos) ? photos : [])
            // allow mobile to send objects like { uri, tag }
            .map((p) => (typeof p === "string" ? p : (p?.uri || "")))
            .filter(Boolean);

        // Vendor can only draft for their assigned visit; admin can pass with user auth
        const query = req.vendor?._id
            ? { _id: id, assignedTo: req.vendor._id }
            : { _id: id };

        const visit = await SiteVisit.findOne(query);
        if (!visit) {
            return res.status(404).json({ success: false, message: "Site visit not found" });
        }

        visit.report = {
            ...(visit.report || {}),
            summary: (summary ?? visit.report?.summary) || "",
            sections: normSections.length ? normSections : (visit.report?.sections || []),
            photos: normPhotos.length ? normPhotos : (visit.report?.photos || []),
            pdfUrl: (pdfUrl ?? visit.report?.pdfUrl) || undefined,
            createdBy: visit.report?.createdBy || visit.assignedTo || undefined,
            verifiedBy: visit.report?.verifiedBy,
            verifiedAt: visit.report?.verifiedAt,
        };

        if (verify) {
            // Only allow when a proper user auth flow sets req.user (admin)
            if (!req.user?._id) {
                return res.status(403).json({ success: false, message: "Only admin can verify reports" });
            }
            visit.report.verifiedBy = req.user._id;
            visit.report.verifiedAt = new Date();
            visit.status = "completed";
            // Mark verification done + report shared + completed
            await markSiteVisitProgress(visit.userId, "verification_done");
            await markSiteVisitProgress(visit.userId, "report_shared");
            // keep legacy call for safety
            await markSiteVisitStep(visit.userId, "completed");
        }
        else {
            // Ensure inputs are considered submitted (idempotent if already done),
            // then move to verification started.
            await markSiteVisitProgress(visit.userId, "inputs_submitted");
            await markSiteVisitProgress(visit.userId, "verification_started");
        }

        await visit.save();
        const populated = await SiteVisit.findById(visit._id)
            .populate("assignedTo", "username mobile role");

        res.json({ success: true, visit: populated });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/site-visits/assigned?vendorUserId=<id>   (temp: query param for testing)
// In production, prefer vendor auth middleware and derive vendor id from token.
export async function listAssignedVisits(req, res) {
    try {
        const vendorId = req.query.vendorUserId || req.user?._id; // fallback for quick test
        if (!vendorId) {
            return res.status(400).json({ success: false, message: "vendorUserId required" });
        }

        const visits = await SiteVisit
            .find({ assignedTo: vendorId })
            .sort({ when: 1, createdAt: 1 })
            .populate("assignedTo", "username mobile role");

        res.json({ success: true, visits });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/** GET /api/vendor/visits/mine */
export async function listMyAssignedVisits(req, res) {
    try {
        const vendorId = req.vendor._id;

        const visits = await SiteVisit.find({ assignedTo: vendorId })
            .sort({ when: 1, createdAt: 1 })
            // show who it's assigned to (me) + keep username/mobile/role fields real
            .populate("assignedTo", "username mobile role");

        res.json({ success: true, visits });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/** GET /api/vendor/visits/:id */
export async function getAssignedVisit(req, res) {
    try {
        const vendorId = req.vendor._id;
        const { id } = req.params;

        const visit = await SiteVisit.findOne({ _id: id, assignedTo: vendorId })
            .populate("assignedTo", "username mobile role");

        if (!visit) {
            return res.status(404).json({ success: false, message: "Visit not found" });
        }

        res.json({ success: true, visit });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/** PATCH /api/vendor/visits/:id/status  { status } */
export async function updateAssignedVisitStatus(req, res) {
    try {
        const vendorId = req.vendor._id;
        const { id } = req.params;
        const { status } = req.body || {};

        const ALLOWED = new Set([
            "confirmed", "in_progress", "submitted_inputs",
            "verifying", "completed", "rescheduled", "cancelled"
        ]);
        if (!ALLOWED.has(String(status || ""))) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const visit = await SiteVisit.findOne({ _id: id, assignedTo: vendorId });
        if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

        // Simple transition guard (loose): allow forward moves & reschedule/cancel
        visit.status = status;
        await visit.save();

        // Map vendor-visible status to step substeps for the user
        switch (status) {
            case "confirmed":
                await markSiteVisitProgress(visit.userId, "engineer_assigned");
                break;
            case "in_progress":
                await markSiteVisitProgress(visit.userId, "inspection_started");
                break;
            case "submitted_inputs":
                await markSiteVisitProgress(visit.userId, "inputs_submitted");
                break;
            case "verifying":
                await markSiteVisitProgress(visit.userId, "verification_started");
                break;
            case "completed":
                // When vendor flips to completed (rare), treat as report shared
                await markSiteVisitProgress(visit.userId, "report_shared");
                break;
            case "rescheduled":
                await markSiteVisitProgress(visit.userId, "rescheduled");
                break;
            case "cancelled":
                await markSiteVisitProgress(visit.userId, "cancelled");
                break;
            default:
                break;
        }

        const populated = await SiteVisit.findById(visit._id)
            .populate("assignedTo", "username mobile role");

        res.json({ success: true, visit: populated });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}