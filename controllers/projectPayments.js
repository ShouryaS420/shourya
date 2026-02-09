// controllers/projectPayments.js
import ProjectDetails from "../models/ProjectDetails.js";
import User from "../models/User.js";
import { sendmail } from "../utils/sendmail.js";

/** Helper: pick the "current" project for this client */
async function findCurrentProjectForClient(clientId) {
    if (!clientId) return null;

    const projects = await ProjectDetails
        .find({ clientId })
        .sort({ createdAt: -1 })
        .lean();

    if (!projects.length) return null;

    // Prefer an actually live/real project
    const preferredStatuses = [
        "project_started",
        "agreement_accepted",
        "agreement_sent",
        "agreement_pending",
    ];

    let current = projects.find(p => preferredStatuses.includes(p.status));
    if (!current) {
        // Fallback: latest project of any status
        current = projects[0];
    }
    return current;
}

/** GET /projects/my/payments
 *
 * Used by: Mobile app `Payments.js`
 * Returns: project + paymentSchedule from ProjectDetails
 */
export const getMyPayments = async (req, res) => {
    try {
        const clientId = req.user?._id;
        if (!clientId) {
            return res
                .status(401)
                .json({ success: false, message: "Unauthorized" });
        }

        const project = await findCurrentProjectForClient(clientId);

        if (!project) {
            return res.json({
                success: true,
                data: null,
                message: "No project found for this account yet.",
            });
        }

        const schedule = Array.isArray(project.paymentSchedule)
            ? project.paymentSchedule
            : [];

        return res.json({
            success: true,
            data: {
                projectId: project._id,
                projectTitle: project.projectTitle,
                status: project.status,
                contractValue: project.contractValue || 0,
                paymentSchedule: schedule,
            },
        });
    } catch (err) {
        console.error("getMyPayments error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
    }
};

/** Helper: format INR (no decimals, with commas) */
function formatINR(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** POST /projects/my/payments/email-next
 *
 * Body: { paymentKey?: string }
 * Used by: Mobile app `Payments.js` -> "Send payment email" button
 */
export const emailNextPayment = async (req, res) => {
    try {
        const clientId = req.user?._id;
        if (!clientId) {
            return res
                .status(401)
                .json({ success: false, message: "Unauthorized" });
        }

        // We need full user to get email & name
        const client = await User.findById(clientId).lean();
        if (!client || !client.email) {
            return res.status(400).json({
                success: false,
                message: "No email found for this client.",
            });
        }

        const project = await findCurrentProjectForClient(clientId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "No project found for this account.",
            });
        }

        const schedule = Array.isArray(project.paymentSchedule)
            ? project.paymentSchedule
            : [];

        if (!schedule.length) {
            return res.status(400).json({
                success: false,
                message:
                    "No payment schedule defined yet. Please contact your 99Squarewall RM.",
            });
        }

        const { paymentKey } = req.body || {};

        // 1️⃣ Pick the target stage
        let targetStage = null;

        if (paymentKey) {
            targetStage = schedule.find((s) => s.key === paymentKey);
        } else {
            // Auto-pick next unpaid stage (pending/due/overdue)
            const pending = schedule.filter((s) => {
                const status = String(s.status || "").toLowerCase();
                return !["paid", "waived"].includes(status);
            });

            pending.sort((a, b) => {
                const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                return da - db;
            });

            targetStage = pending[0];
        }

        if (!targetStage) {
            return res.status(400).json({
                success: false,
                message: "No pending payment stage found.",
            });
        }

        const amount = Number(targetStage.amount || 0);
        const dueDateStr = targetStage.dueDate
            ? new Date(targetStage.dueDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })
            : "To be scheduled";

        const clientName =
            client.username ||
            client.fullName ||
            client.name ||
            `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
            "Client";

        const subject = `Next stage payment – ${targetStage.label} | ${project.projectTitle || "99Squarewall Project"
            }`;

        // Simple, clean payment email (you can refine later with your screenshot design)
        const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f6f7ff; padding:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">
                <tr>
                  <td style="background:#002CFA; padding:18px 22px;">
                    <div style="color:#fff; font-size:16px; font-weight:700;">99Squarewall</div>
                    <div style="color:#cfe0ff; font-size:12px; margin-top:2px;">Construction payments – stage-wise and transparent.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px;">
                    <div style="font-size:15px; color:#111; margin-bottom:10px;">
                      Hi ${clientName},
                    </div>
                    <div style="color:#333; font-size:14px; line-height:1.5; margin-bottom:16px;">
                      This is a gentle reminder for your next stage payment for the project
                      <strong>${project.projectTitle || "your 99Squarewall project"}</strong>.
                    </div>

                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; background:#F7F8FF; border:1px solid #ECECFE; border-radius:10px; margin-bottom:16px;">
                      <tr>
                        <td style="padding:12px 14px; font-size:14px;">
                          <div><b>Stage:</b> ${targetStage.label}</div>
                          ${targetStage.description
                ? `<div style="margin-top:2px;">${targetStage.description}</div>`
                : ""
            }
                          <div style="margin-top:6px;"><b>Amount:</b> ₹ ${formatINR(amount)}/-</div>
                          <div><b>Due date:</b> ${dueDateStr}</div>
                        </td>
                      </tr>
                    </table>

                    <div style="color:#4b5563; font-size:13px; line-height:1.6; margin-bottom:16px;">
                      Our team will share a secure payment link and/or bank details separately.
                      If you have already completed this payment, please ignore this message
                      or share the transaction reference with your Relationship Manager.
                    </div>

                    <div style="color:#6b7280; font-size:12px; margin-top:4px;">
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

        return res.json({
            success: true,
            message: "Payment email sent successfully.",
            projectId: project._id,
            paymentKey: targetStage.key,
        });
    } catch (err) {
        console.error("emailNextPayment error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Server error while sending payment email." });
    }
};
