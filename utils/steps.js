import User from "../models/User.js";

const STEP_TITLE = "Site Visit & Clarity Report";
const TITLE_NORM = STEP_TITLE.trim().toLowerCase();

const DEFAULT_SUBSTEPS = [
    { title: "Booking confirmed", description: "Visit scheduled; reference and time window shared.", status: "" },
    { title: "Engineer assigned", description: "Assigned engineer details shared with client.", status: "" },
    { title: "On-site inspection", description: "Photos, measurements, access, services, risks.", status: "" },
    { title: "Inputs captured", description: "Field engineer’s site inputs saved and submitted.", status: "" },
    { title: "Verification", description: "Admin review & recommendations.", status: "" },
    { title: "Clarity Report shared", description: "Final report published in the app.", status: "" },
];

function ensureSubsteps(shape) {
    if (!Array.isArray(shape.subSteps) || shape.subSteps.length === 0) {
        shape.subSteps = DEFAULT_SUBSTEPS.map(s => ({ ...s }));
    }
    return shape;
}

function setSubStepStatus(step, subTitle, status) {
    const i = (step.subSteps || []).findIndex(
        s => String(s?.title || "").trim().toLowerCase() === String(subTitle).trim().toLowerCase()
    );
    if (i >= 0) step.subSteps[i].status = status;
}

/**
 * Idempotently marks the user's "Site Visit & Clarity Report" step.
 * nextStatus: "ongoing-stage" | "completed"
 */
export async function markSiteVisitStep(userId, nextStatus) {
    const user = await User.findById(userId);
    if (!user) return;

    const steps = Array.isArray(user.steps) ? user.steps : [];
    const idx = steps.findIndex(s => String(s?.title || "").trim().toLowerCase() === TITLE_NORM);

    if (idx === -1) {
        // Only create if missing (shouldn’t happen because you seed it at signup)
        steps.splice(1, 0, ensureSubsteps({
            title: STEP_TITLE,
            description:
                "On-site evaluation and clarity report to reflect real conditions and BOQ considerations.",
            status: nextStatus || "ongoing-stage",
            subSteps: DEFAULT_SUBSTEPS.map(s => ({ ...s })),
        }));
    } else {
        // Update existing, don’t duplicate
        ensureSubsteps(steps[idx]);
        steps[idx].status = nextStatus || steps[idx].status || "ongoing-stage";

        // Gentle progression for common events
        if ((nextStatus || "").includes("ongoing")) {
            setSubStepStatus(steps[idx], "Booking confirmed", "completed");
        }
        if (nextStatus === "completed") {
            setSubStepStatus(steps[idx], "Clarity Report shared", "completed");
        }
    }

    user.steps = steps;
    user.markModified("steps");
    await user.save();
}


/**
 * New: granular progress marker for sub-steps.
 * action:
 *  - "booking_confirmed"
 *  - "engineer_assigned"
 *  - "inspection_started"
 *  - "inputs_submitted"
 *  - "verification_started"
 *  - "verification_done"
 *  - "report_shared"
 *  - "rescheduled"
 *  - "cancelled"
 */
export async function markSiteVisitProgress(userId, action) {
    const user = await User.findById(userId);
    if (!user) return;

    const steps = Array.isArray(user.steps) ? user.steps : [];
    let idx = steps.findIndex(s => String(s?.title || "").trim().toLowerCase() === TITLE_NORM);

    if (idx === -1) {
        steps.splice(1, 0, ensureSubsteps({
            title: STEP_TITLE,
            description: "On-site evaluation and clarity report to reflect real conditions and BOQ considerations.",
            status: "ongoing-stage",
            subSteps: DEFAULT_SUBSTEPS.map(s => ({ ...s })),
        }));
        idx = steps.findIndex(s => String(s?.title || "").trim().toLowerCase() === TITLE_NORM);
    } else {
        ensureSubsteps(steps[idx]);
        if (!steps[idx].status) steps[idx].status = "ongoing-stage";
    }

    const step = steps[idx];

    const complete = (title) => setSubStepStatus(step, title, "completed");
    const progress = (title) => setSubStepStatus(step, title, "ongoing-stage");

    switch (action) {
        case "booking_confirmed":
            step.status = "ongoing-stage";
            complete("Booking confirmed");
            break;
        case "engineer_assigned":
            step.status = "ongoing-stage";
            complete("Booking confirmed");
            complete("Engineer assigned");
            break;
        case "inspection_started":
            step.status = "ongoing-stage";
            complete("Booking confirmed");
            complete("Engineer assigned");
            progress("On-site inspection");
            break;
        case "inputs_submitted":
            step.status = "ongoing-stage";
            complete("Booking confirmed");
            complete("Engineer assigned");
            complete("On-site inspection");
            complete("Inputs captured");
            break;
        case "verification_started":
            step.status = "ongoing-stage";
            progress("Verification");
            break;
        case "verification_done":
            step.status = "ongoing-stage";
            complete("Verification");
            break;
        case "report_shared":
            complete("Verification"); // harmless if already completed
            complete("Clarity Report shared");
            step.status = "completed";
            break;
        case "rescheduled":
            // Keep step ongoing, don’t regress completed substeps
            step.status = "ongoing-stage";
            break;
        case "cancelled":
            // Optional: reflect cancellation on the parent step
            step.status = "cancelled";
            break;
        default:
            break;
    }

    user.steps = steps;
    user.markModified("steps");
    await user.save();
}