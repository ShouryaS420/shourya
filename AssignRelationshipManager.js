import cron from "node-cron";
import Project from './models/ProjectDetails.js'; // Your project schema
import VendorUsers from "./models/VendorUsers.js"; // Your vendor (team) schema
import { sendmail } from "./utils/sendmail.js";

// Cron job runs every 10 minutes
const assignNewRMToLeads = async () => {
    console.log("🔄 Running Cron Job for Relationship Manager Assignment...");

    try {
        // Step 1: Find Unassigned "New Lead" Projects
        const unassignedProjects = await Project.find({
            status: "Site Visit",
            assignedTeamMember: { $size: 0 }, // Check if empty array
        });

        if (unassignedProjects.length === 0) {
            console.log("✅ No unassigned 'Site Visit' projects found.");
            return;
        }

        // Step 2: Find Available Relationship Managers
        const relationshipManagers = await VendorUsers.find({ role: "Relationship Manager" });

        if (relationshipManagers.length === 0) {
            console.log("❌ No Relationship Managers available.");
            return;
        }

        // Step 3: Assign Projects to Available Sales Executives
        for (let i = 0; i < unassignedProjects.length; i++) {
            const project = unassignedProjects[i];

            // Rotate through RMs for assignment to distribute workload
            const assignedRMs = relationshipManagers[i % relationshipManagers.length];

            // project.assignedTeamMember = assignedRMs.map(rm => rm._id); // Assign user ID
            // project.assignedDepartments = "Customer Support";
            // Assign the RM to the project
            project.assignedTeamMember.push({
                id: assignedRMs._id,
                department: assignedRMs.department ? [assignedRMs.department] : [], // Assuming department info is handled elsewhere or not applicable here
                assignedWork: `Primary Relationship Manager for ${project.clientName}`
            });

            await project.save(); // Save updates to database
            console.log(`✅ Assigned Project ${project.projectId} to RMs: ${assignedRMs.username}`);

            // Step 4: Send Meeting Details via Email
            const emailSubjectClient = `Hi ${project.clientName}, Your Personal Relationship Manager from 99Squarewall is Here to Assist!`;
            const emailMessageClient = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                        .email-container { max-width: 600px; margin: auto; background: #ffffff; border: 1px solid #dddddd; }
                        .header { background-color: #fff; color: #ffffff; padding: 10px 20px; text-align: center; }
                        .content { padding: 20px; }
                        .footer { background-color: #f9f9f9; color: #777777; text-align: center; padding: 10px 20px; font-size: 14px; }
                        .button { background-color: #0046d5; color: #ffffff !important; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="header">
                            <img src="https://99squarewall.com/img/Logo-01.png" alt="99SquareWall" style="max-width: 150px; margin-bottom: 10px;">
                        </div>
                        <div class="content">
                            <p>Dear <strong>${project.clientName}</strong>,</p>
                            <p>We hope this message finds you well. We're pleased to introduce <strong>${assignedRMs.username}</strong> as your dedicated Relationship Manager. They will be your primary point of contact for all your needs and queries with our company.</p>
                            
                            <h2>Relationship Manager Details</h2>
                            <li>
                                <strong>${assignedRMs.username}</strong> - 📞 
                                <a href="tel:${assignedRMs.mobile}" style="color: #007bff;">${assignedRMs.mobile}</a> - 📧 
                                <a href="mailto:${assignedRMs.email}" style="color: #007bff;">${assignedRMs.email}</a>
                            </li>
 
                            <p>Your Relationship Manager is available to assist you with a range of services including, but not limited to:</p>
                            <ul>
                                <li>Project updates and timelines</li>
                                <li>Scheduling appointments and meetings</li>
                                <li>Answering any questions regarding our services</li>
                                <li>Providing personalized advice and recommendations</li>
                            </ul>
                            
                            <p>Please feel free to reach out directly to your Relationship Manager at any time. They are here to ensure your experience with us is smooth and satisfactory.</p>
                            <p style="text-align:center;">
                                <a href="mailto:${assignedRMs.email}" class="button">Contact Relationship Manager</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>If you have any immediate questions, feel free to contact us at <a href="mailto:support@99squarewall.com">support@99squarewall.com</a>.</p>
                        </div>
                    </div>
                </body>
                </html>

            `;

            // Send Email to Client
            await sendmail(project.clientEmail, emailSubjectClient, emailMessageClient);
            // Send Emails to RMs
            // for (const rm of assignedRMs) {
                const emailSubjectRM = `Hi ${assignedRMs.username}, You've Been Assigned a New Client - ${project.clientName}`;
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
                            .button { background-color: #0046d5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <img src="https://99squarewall.com/img/Logo-01.png" alt="99SquareWall" style="max-width: 150px; margin-bottom: 10px;">
                            </div>
                            <div class="content">
                                <p>Dear <strong>${assignedRMs.username}</strong>,</p>
                                <p>We are pleased to inform you that you have been assigned as the Relationship Manager for a new client. Below are the details to help you get started with this engagement:</p>
                                
                                <h2>Client Details</h2>
                                <p><strong>Name:</strong> ${project.clientName}</p>
                                <p><strong>Email:</strong> <a href="mailto:{${project.clientEmail}}">${project.clientEmail}</a></p>
                                <p><strong>Phone Number:</strong> <a href="tel:{${project.clientMobile}}">${project.clientMobile}</a></p>

                                <h2>Expectations</h2>
                                <p>As the assigned Relationship Manager, you are expected to:</p>
                                <ul>
                                    <li>Initiate contact within 24 hours of this assignment.</li>
                                    <li>Set up an introductory meeting to understand client needs and expectations.</li>
                                    <li>Maintain regular communication and provide updates on our services and solutions.</li>
                                    <li>Be the primary point of contact for all client queries and concerns.</li>
                                </ul>
                                
                                <p>Please ensure that you log all interactions with the client in our CRM system to keep the team updated on your progress.</p>
                                
                                <p>Thank you for your attention to this new assignment. We are confident in your ability to represent 99squarewall and manage this relationship effectively.</p>
                            </div>
                            <div class="footer">
                                <p>If you have any questions or need further details, please do not hesitate to contact your supervisor.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await sendmail(assignedRMs.email, emailSubjectRM, emailMessageRM);
            // }

            // Send Email to Assigned Expert
            // await sendmail(assignedExecutive.email, emailSubjectRM, emailMessageRM);

            console.log(`📩 Emails Sent to Client & Assigned RMs for Project ${project.projectId}`);
        }

    } catch (error) {
        console.error("❌ Error in cron job:", error);
    }
};

// Schedule the cron job to run every 10 minutes
const startAssignRmCronJobs = () => {
    cron.schedule("*/10 * * * * *", assignNewRMToLeads);
};

export default startAssignRmCronJobs;