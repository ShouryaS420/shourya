// workers/paymentReminderWorker.js
import cron from "node-cron";
import mongoose from "mongoose";
import dayjs from "dayjs";

import ProjectDetails from "../models/ProjectDetails.js";
import User from "../models/User.js";
import EmailEvent from "../models/EmailEvent.js";
import { sendmail } from "../utils/sendmail.js"; // use your existing email util

// ---------- DB CONNECT ----------
async function connectDb() {
    if (mongoose.connection.readyState === 1) return;

    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("PaymentReminderWorker: MONGO_URI not set");
        throw new Error("MONGO_URI not set");
    }

    await mongoose.connect(uri, {
        // add your options if needed
    });
    console.log("PaymentReminderWorker: Mongo connected");
}

// ---------- HELPERS ----------
function formatINR(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Map (dueDate - today) → milestone tag
function getReminderMilestone(daysDiff) {
    switch (daysDiff) {
        case 7:
            return "T-7";   // 7 days before
        case 2:
            return "T-2";   // 2 days before
        case 0:
            return "T";     // on due date
        case -3:
            return "T+3";   // 3 days after
        case -7:
            return "T+7";   // 7 days after
        case -15:
            return "T+15";  // 15 days after (last)
        default:
            return null;
    }
}

// Build payment reminder email (subject + html) for this stage
function buildPaymentReminderEmail({ client, project, stage, milestone }) {
    const clientName =
        client.username ||
        client.fullName ||
        client.name ||
        `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
        "Client";

    const projectTitle =
        project.projectTitle ||
        project.projectName ||
        "your construction project";

    const projectCode = project.projectCode || project.projectId || project._id;

    const stageLabel = stage.label || "Payment stage";
    const amountStr = formatINR(stage.amount || 0);
    const dueDateObj = stage.dueDate ? new Date(stage.dueDate) : null;
    const dueDateStr = dueDateObj
        ? dueDateObj.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "To be decided";

    // Subject based on milestone
    let subject;
    if (milestone === "T-7" || milestone === "T-2") {
        subject = `Upcoming payment – “${stageLabel}” for your 99Squarewall project`;
    } else if (milestone === "T") {
        subject = `Payment due today – “${stageLabel}” for your 99Squarewall project`;
    } else {
        subject = `Overdue payment – “${stageLabel}” for your 99Squarewall project`;
    }

    // Bank details from ENV (configure in .env)
    const bankName = process.env.BANK_NAME || "HDFC Bank";
    const bankAccount = process.env.BANK_ACCOUNT || "000000000000";
    const bankIfsc = process.env.BANK_IFSC || "HDFC0000000";
    const bankAccountName =
        process.env.BANK_ACCOUNT_NAME || "99Squarewall Construction Pvt. Ltd.";
    const bankAccountType = process.env.BANK_ACCOUNT_TYPE || "Current";
    const upiId = process.env.BANK_UPI || "99squarewall@upi";

    const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f6f7ff; padding:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="background:#002CFA; padding:18px 22px;">
            <div style="color:#fff; font-size:16px; font-weight:700;">99Squarewall</div>
            <div style="color:#cfe0ff; font-size:12px; margin-top:2px;">
              Stage-wise construction payments, made clear and transparent.
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:22px;">
            <div style="font-size:15px; color:#111; margin-bottom:8px;">
              Hi ${clientName},
            </div>

            <div style="color:#374151; font-size:14px; line-height:1.6; margin-bottom:14px;">
              This is a friendly reminder for the next payment stage of your construction project
              <strong>${projectTitle}</strong> with 99Squarewall.
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; background:#F7F8FF; border:1px solid #E5E7EB; border-radius:10px; margin-bottom:16px;">
              <tr>
                <td style="padding:12px 14px; font-size:13px;">
                  <div style="margin-bottom:4px;"><strong>Stage:</strong> ${stageLabel}</div>
                  <div style="margin-bottom:4px;"><strong>Amount:</strong> ₹ ${amountStr}/-</div>
                  <div style="margin-bottom:4px;"><strong>Due date:</strong> ${dueDateStr}</div>
                  <div><strong>Project code:</strong> ${projectCode}</div>
                </td>
              </tr>
            </table>

            <div style="color:#374151; font-size:14px; line-height:1.6; margin-bottom:14px;">
              Please arrange the payment of <strong>₹ ${amountStr}/-</strong> on or before
              <strong>${dueDateStr}</strong> by either:
            </div>

            <ul style="color:#374151; font-size:14px; line-height:1.6; padding-left:20px; margin-bottom:16px;">
              <li><strong>Self-funded:</strong> transfer directly to the 99Squarewall bank account given below.</li>
              <li><strong>Home loan:</strong> raise a disbursement request with your bank for this stage and
                  share the disbursement proof / UTR once released.</li>
            </ul>

            <div style="background:#F9FAFB; border:1px dashed #D1D5DB; border-radius:10px; padding:12px 14px; font-size:13px; color:#111827; margin-bottom:16px;">
              <div style="font-weight:600; margin-bottom:6px;">99Squarewall Bank Details</div>
              <div>Account name: <strong>${bankAccountName}</strong></div>
              <div>Bank name: <strong>${bankName}</strong></div>
              <div>Account number: <strong>${bankAccount}</strong></div>
              <div>IFSC: <strong>${bankIfsc}</strong></div>
              <div>Account type: <strong>${bankAccountType}</strong></div>
              <div style="margin-top:6px;">UPI ID (optional): <strong>${upiId}</strong></div>
            </div>

            <div style="color:#374151; font-size:13px; line-height:1.6; margin-bottom:14px;">
              While making the payment, please mention the reference:
              <strong>"${projectCode} – ${stageLabel}"</strong> in the remarks / description.
            </div>

            <div style="color:#374151; font-size:13px; line-height:1.6; margin-bottom:16px;">
              After completing the payment, kindly reply to this email or WhatsApp thread with the
              <strong>payment proof</strong> so that we can mark this stage as <strong>paid</strong>.
            </div>

            <div style="color:#6B7280; font-size:12px; line-height:1.6; margin-bottom:18px;">
              If you have already completed this payment, please ignore this reminder. Our team will update
              your project records shortly.
            </div>

            <div style="color:#6B7280; font-size:12px;">
              Warm regards,<br/>
              <strong>99Squarewall Construction Team</strong><br/>
              connect@99squarewall.com<br/>
              www.99squarewall.com
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

    return { subject, html };
}

// ---------- CORE JOB ----------
export default async function runPaymentReminderJob() {
    await connectDb();

    const today = dayjs().startOf("day");

    // Projects that actually have a schedule + client + contract
    const projects = await ProjectDetails.find({
        contractValue: { $gt: 0 },
        paymentSchedule: { $exists: true, $not: { $size: 0 } },
        clientId: { $exists: true, $ne: null },
    }).lean();

    console.log(
        `PaymentReminderWorker: checking ${projects.length} projects on ${today.format(
            "YYYY-MM-DD"
        )}`
    );

    for (const p of projects) {
        const client = await User.findById(p.clientId).lean();
        if (!client || !client.email) continue;

        let projectDoc = null;
        let anyStageUpdated = false;

        const schedule = p.paymentSchedule || [];
        for (let i = 0; i < schedule.length; i++) {
            const s = schedule[i];
            if (!s) continue;

            // Skip if no due date or disabled
            if (!s.dueDate || s.reminderDisabled) continue;

            const amount = Number(s.amount || 0);
            const paidAmount = Number(s.paidAmount || 0);

            // Skip fully paid / waived
            if (s.status === "paid" || s.status === "waived" || paidAmount >= amount) {
                continue;
            }

            const due = dayjs(s.dueDate).startOf("day");
            const daysDiff = due.diff(today, "day"); // due - today
            const milestone = getReminderMilestone(daysDiff);
            if (!milestone) continue;

            const milestonesSent = Array.isArray(s.reminderMilestonesSent)
                ? s.reminderMilestonesSent
                : [];

            if (milestonesSent.includes(milestone)) {
                // already sent this milestone reminder
                continue;
            }

            // Lazy-load full doc only when we actually need to modify
            if (!projectDoc) {
                projectDoc = await ProjectDetails.findById(p._id);
                if (!projectDoc) break;
            }

            const stageDoc = projectDoc.paymentSchedule[i];
            if (!stageDoc) continue;

            const { subject, html } = buildPaymentReminderEmail({
                client,
                project: p,
                stage: stageDoc,
                milestone,
            });

            try {
                // Use your existing email sender
                await sendmail({
                    to: client.email,
                    subject,
                    html,
                });

                // await EmailEvent.create({
                //     event: "payment_reminder",
                //     projectId: p._id,
                //     clientId: client._id,
                //     stageKey: stageDoc.key,
                //     milestone,
                //     to: client.email,
                // });

                // Mark milestone as sent
                const ms = Array.isArray(stageDoc.reminderMilestonesSent)
                    ? stageDoc.reminderMilestonesSent
                    : [];
                stageDoc.reminderMilestonesSent = [...ms, milestone];

                // Status hints: on due date → due; after due date → overdue (if still unpaid)
                if (milestone === "T" && stageDoc.status === "pending") {
                    stageDoc.status = "due";
                }
                if (daysDiff < 0 && stageDoc.status !== "paid" && stageDoc.status !== "waived") {
                    stageDoc.status = "overdue";
                }

                anyStageUpdated = true;

                console.log(
                    `PaymentReminderWorker: sent ${milestone} reminder for project=${p._id}, stage=${stageDoc.key}, to=${client.email}`
                );
            } catch (err) {
                console.error(
                    `PaymentReminderWorker: failed reminder for project=${p._id}, stage=${stageDoc.key}`,
                    err
                );
            }
        }

        if (anyStageUpdated && projectDoc) {
            projectDoc.markModified("paymentSchedule");
            await projectDoc.save();
        }
    }

    console.log("PaymentReminderWorker: run complete");
}

// ---------- CRON SCHEDULE ----------
// Every day at 08:00 server time
// cron.schedule("0 8 * * *", () => {
cron.schedule("* * * * *", () => {
    console.log("PaymentReminderWorker: cron trigger fired");
    runPaymentReminderJob().catch((e) =>
        console.error("PaymentReminderWorker: job error", e)
    );
});

// Optional: run once on startup (useful for testing)
// runPaymentReminderJob().catch(console.error);
