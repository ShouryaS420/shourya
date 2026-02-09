// cron/startAssignRmCronJobs.js
import cron from "node-cron";
import User from "../models/User.js";
import VendorUsers from "../models/VendorUsers.js";
import Estimate from "../models/Estimate.js";
import { sendmail } from "../utils/sendmail.js";

const ESTIMATE_STATUS = {
    CONNECTING_RM: "Connecting RM",
    RM_ASSIGNED: "RM Assigned", // or "RM Assigned - Pending Call", etc.
};

const assignRmToConnectingRmLeads = async () => {
    console.log("🔄 Cron: Assigning Relationship Managers to 'Connecting RM' quotations...");

    try {
        // 1) Fetch ACTIVE Relationship Managers
        let rms = await VendorUsers.find({
            role: "Relationship Manager",
            isActive: true,
        }).sort({ lastAssignedAt: 1 }); // oldest assigned first → fair rotation

        if (!rms.length) {
            console.log("❌ No active Relationship Managers found.");
            return;
        }

        // Optional: respect dailyLimit (soft capacity)
        rms = rms.filter(rm => {
            const limit = typeof rm.dailyLimit === "number" ? rm.dailyLimit : 9999;
            const todayCount = typeof rm.assignedToday === "number" ? rm.assignedToday : 0;
            return todayCount < limit;
        });

        if (!rms.length) {
            console.log("⚠️ All RMs are at their daily limit. Skipping assignment.");
            return;
        }

        // 2) Find users whose constructionDetails entries are in "Connecting RM" and not assigned
        const users = await User.find({
            constructionDetails: {
                $elemMatch: {
                    status: ESTIMATE_STATUS.CONNECTING_RM,
                    assignedRM: null,
                },
            },
        }).select("username email mobile userId constructionDetails assignedTeamMember");

        if (!users.length) {
            console.log("✅ No unassigned 'Connecting RM' leads found.");
            return;
        }

        console.log(`🧾 Found ${users.length} user(s) with pending 'Connecting RM' quotations.`);

        let rmIndex = 0;
        const touchedRmIds = new Set();

        for (const user of users) {
            let changedUser = false;

            // Iterate each constructionDetails row for this user
            for (const cd of user.constructionDetails || []) {
                if (cd.status !== "Connecting RM" || cd.assignedRM) continue;

                // 3) Pick next available RM in round-robin
                if (!rms.length) {
                    console.log("⚠️ Ran out of available RMs while assigning.");
                    break;
                }

                const rm = rms[rmIndex % rms.length];
                rmIndex += 1;

                // Mark this RM as touched so we save updated metrics later
                touchedRmIds.add(String(rm._id));

                // 3a) Update constructionDetails row
                cd.assignedRM = String(rm._id);
                cd.meetingType = cd.meetingType || null;
                cd.meetingDate = cd.meetingDate || null;
                cd.meetingTime = cd.meetingTime || null;

                // 🔁 move this construction row to "RM Assigned"
                cd.status = ESTIMATE_STATUS.RM_ASSIGNED;

                // 3b) Add to user's assignedTeamMember list
                user.assignedTeamMember = user.assignedTeamMember || [];
                user.assignedTeamMember.push({
                    id: rm._id,
                    department: rm.department || "Relationship Manager",
                    assignedWork: `Primary Relationship Manager for Estimate ${cd.estimateHumanId || cd.estimateId || ""}`,
                });

                changedUser = true;

                // 3c) Update RM load metrics
                rm.assignedToday = (rm.assignedToday || 0) + 1;
                rm.lastAssignedAt = new Date();

                const estimateId = cd.estimateId || null;
                const estimateHumanId = cd.estimateHumanId || null;
                const clientName = user.username || "Valued Customer";
                const clientEmail = user.email;
                const clientMobile = user.mobile;

                // 3d) OPTIONAL: mark Estimate with status/assignedRM (Mongo allows extra fields)
                // 3d) Mark Estimate as RM Assigned + attach RM
                if (estimateId) {
                    try {
                        const updated = await Estimate.findByIdAndUpdate(
                            estimateId,
                            {
                                $set: {
                                    status: ESTIMATE_STATUS.RM_ASSIGNED,
                                    assignedRM: rm._id,
                                },
                            },
                            { new: true }
                        );

                        if (!updated) {
                            console.warn(
                                `⚠️ No Estimate found for _id=${estimateId} when assigning RM for user ${user.userId}`
                            );
                        }
                    } catch (e) {
                        console.warn(
                            `⚠️ Failed to update Estimate ${estimateId} for user ${user.userId}:`,
                            e.message
                        );
                    }
                } else if (estimateHumanId) {
                    try {
                        const updated = await Estimate.findOneAndUpdate(
                            { humanId: estimateHumanId },
                            {
                                $set: {
                                    status: ESTIMATE_STATUS.RM_ASSIGNED,
                                    assignedRM: rm._id,
                                },
                            },
                            { new: true }
                        );

                        if (!updated) {
                            console.warn(
                                `⚠️ No Estimate found for humanId=${estimateHumanId} when assigning RM for user ${user.userId}`
                            );
                        }
                    } catch (e) {
                        console.warn(
                            `⚠️ Failed to update Estimate(humanId=${estimateHumanId}) for user ${user.userId}:`,
                            e.message
                        );
                    }
                }

                // 4) Send EMAILS
                try {
                    // 4a) Email to Client
                    if (clientEmail) {
                        const emailSubjectClient = `Hi ${clientName}, Your Personal Relationship Manager from 99Squarewall is Here to Assist!`;
                        const emailMessageClient = `
                            <!DOCTYPE html>
                            <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                    body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                                    .email-container { max-width: 600px; margin: auto; background: #ffffff; border: 1px solid #dddddd; }
                                    .header { background-color: #fff; padding: 10px 20px; text-align: center; }
                                    .content { padding: 20px; }
                                    .footer { background-color: #f9f9f9; color: #777777; text-align: center; padding: 10px 20px; font-size: 14px; }
                                    .button { background-color: #0046d5; color: #ffffff !important; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
                                </style>
                            </head>
                            <body>
                                <div class="email-container">
                                    <div class="header">
                                        <img src="https://99squarewall.com/img/Logo-01.png" alt="99Squarewall" style="max-width: 150px; margin-bottom: 10px;">
                                    </div>
                                    <div class="content">
                                        <p>Dear <strong>${clientName}</strong>,</p>
                                        <p>Thank you for reviewing your quotation with 99Squarewall. We’re excited to take the next step with you.</p>
                                        <p>We’re pleased to introduce <strong>${rm.username}</strong> as your dedicated Relationship Manager. They’ll be your primary point of contact for everything related to your home construction journey.</p>
                                        
                                        <h2>Relationship Manager Details</h2>
                                        <ul>
                                            <li>
                                                <strong>${rm.username}</strong><br />
                                                📞 <a href="tel:${rm.mobile}" style="color: #007bff;">${rm.mobile || "Not Available"}</a><br/>
                                                📧 <a href="mailto:${rm.email}" style="color: #007bff;">${rm.email || "Not Available"}</a>
                                            </li>
                                        </ul>
        
                                        <p>Your Relationship Manager will help you with:</p>
                                        <ul>
                                            <li>Clarifying your quotation & package details</li>
                                            <li>Scheduling meetings or site visits</li>
                                            <li>Answering any project or process related queries</li>
                                            <li>Guiding you from quotation to agreement & project kick-off</li>
                                        </ul>
                                        
                                        <p style="text-align:center; margin-top: 18px;">
                                            <a href="mailto:${rm.email}" class="button">Contact Relationship Manager</a>
                                        </p>
                                    </div>
                                    <div class="footer">
                                        <p>For any urgent help, you can also write to us at <a href="mailto:support@99squarewall.com">support@99squarewall.com</a>.</p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `;

                        await sendmail(clientEmail, emailSubjectClient, emailMessageClient);
                        console.log(`📩 Client email sent to ${clientEmail} for user ${user.userId}`);
                    } else {
                        console.log(`ℹ️ Skipping client email for user ${user.userId} — no email stored.`);
                    }

                    // 4b) Email to RM
                    if (rm.email) {
                        const emailSubjectRM = `Hi ${rm.username}, New 99Squarewall Client Assigned - ${clientName}`;
                        const emailMessageRM = `
                            <!DOCTYPE html>
                            <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                    body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                                    .email-container { max-width: 600px; margin: auto; background: #ffffff; border: 1px solid #dddddd; }
                                    .header { background-color: #fff; padding: 10px 20px; text-align: center; }
                                    .content { padding: 20px; }
                                    .footer { background-color: #f9f9f9; color: #777777; text-align: center; padding: 10px 20px; font-size: 14px; }
                                </style>
                            </head>
                            <body>
                                <div class="email-container">
                                    <div class="header">
                                        <img src="https://99squarewall.com/img/Logo-01.png" alt="99Squarewall" style="max-width: 150px; margin-bottom: 10px;">
                                    </div>
                                    <div class="content">
                                        <p>Dear <strong>${rm.username}</strong>,</p>
                                        <p>You have been assigned as the Relationship Manager for a new client from 99Squarewall.</p>
                                        
                                        <h2>Client Details</h2>
                                        <p><strong>Name:</strong> ${clientName}</p>
                                        <p><strong>Email:</strong> ${clientEmail || "Not Available"}</p>
                                        <p><strong>Phone:</strong> ${clientMobile || "Not Available"}</p>
                                        ${estimateHumanId ? `<p><strong>Estimate ID:</strong> ${estimateHumanId}</p>` : ""}
        
                                        <h2>Your Next Actions</h2>
                                        <ul>
                                            <li>Initiate contact within 24 hours of assignment.</li>
                                            <li>Introduce yourself and understand the client’s requirements and priorities.</li>
                                            <li>Walk them through their quotation and resolve any doubts.</li>
                                            <li>Assist them in moving towards agreement & booking payment.</li>
                                        </ul>
                                        
                                        <p>Please log all interactions with the client in the CRM so the entire team has visibility.</p>
                                    </div>
                                    <div class="footer">
                                        <p>If you need any support, please reach out to your supervisor or the operations team.</p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `;

                        await sendmail(rm.email, emailSubjectRM, emailMessageRM);
                        console.log(`📩 RM email sent to ${rm.email} for user ${user.userId}`);
                    } else {
                        console.log(`ℹ️ Skipping RM email for ${rm.username} — no email stored.`);
                    }
                } catch (mailErr) {
                    console.error("❌ Error sending emails for user", user.userId, ":", mailErr);
                }

                console.log(
                    `✅ Assigned RM ${rm.username} (${rm._id}) to user ${user.userId} (estimate ${estimateHumanId || estimateId || "n/a"})`
                );
            }

            if (changedUser) {
                user.markModified("constructionDetails");
                user.markModified("assignedTeamMember");
                await user.save();
            }
        }

        // 5) Save updated RM metrics (assignedToday, lastAssignedAt)
        const touched = Array.from(touchedRmIds);
        for (const rmId of touched) {
            const rm = rms.find(r => String(r._id) === rmId);
            if (!rm) continue;
            try {
                await rm.save();
            } catch (e) {
                console.warn(`⚠️ Failed to save RM metrics for ${rm.username} (${rmId}):`, e.message);
            }
        }

        console.log("🎉 RM assignment cron completed.");

    } catch (error) {
        console.error("❌ Error in RM assignment cron:", error);
    }
};

// Schedule: every 10 minutes
export const startAssignRmCronJobs = () => {
    // "*/10 * * * *" = every 10 minutes
    cron.schedule("*/1 * * * *", assignRmToConnectingRmLeads, {
        timezone: "Asia/Kolkata",
    });
};

export default startAssignRmCronJobs;
