import cron from "node-cron";
import Project from './models/ProjectDetails.js'; // Your project schema
import VendorUsers from "./models/VendorUsers.js"; // Your vendor (team) schema
import { sendmail } from "./utils/sendmail.js";

// Track the last assigned index for round-robin distribution
let lastAssignedIndex = 0;

// Cron job runs every 10 minutes
const assignNewLeads = async () => {
    console.log("🔄 Running Cron Job for Site Visit Assignment...");

    try {
        // Step 1: Find Unassigned "New Lead" Projects
        const unassignedProjects = await Project.find({
            status: "Site Visit",
            isSiteVisit: true,
        });

        if (unassignedProjects.length === 0) {
            console.log("✅ No unassigned 'Site Visit' projects found.");
            return;
        }

        // Step 2: Find Available Sales Executives
        const fieldExecutives = await VendorUsers.find({ role: "Field Executive" });

        if (fieldExecutives.length === 0) {
            console.log("❌ No Field Executives available.");
            return;
        }

        // Step 3: Assign Projects to Multiple Field Executives
        for (let i = 0; i < unassignedProjects.length; i++) {
            const project = unassignedProjects[i];

            // Select the next Field Executive in round-robin order
            const assignedExecutive = fieldExecutives[lastAssignedIndex % fieldExecutives.length];
            lastAssignedIndex++;  // Move to next index for round-robin

            // ✅ Preserve existing assigned members (like RM) & add the new Field Executive
            const updatedAssignedTeamMembers = [
                ...project.assignedTeamMember,
                {
                    id: assignedExecutive._id,
                    department: assignedExecutive.department ? [assignedExecutive.department] : [],
                    assignedWork: `Site Visit for ${project.clientName}`
                }
            ];

            // ✅ Update Project Data
            project.assignedTeamMember = updatedAssignedTeamMembers;
            project.isSiteVisit = false;
            project.taskProgress = [
                { stageName: "Site Visit", progress: "Ongoing",
                    tasks: [
                        { taskName: "Proceed Visit Site", status: "ongoing" },
                    ]
                }
            ];

            // ✅ Assign Task to the Selected Field Executive
            const newTask = {
                taskName: `Site Visit for ${project.clientName}`,
                assignedTo: assignedExecutive.username,
                status: "Pending",
                assignedDate: new Date(),
            };

            project.assignedTasks = [...(project.assignedTasks || []), newTask];

            await project.save(); // Save updates to database
            console.log(`✅ Assigned Project ${project.projectId} to ${assignedExecutive.username}`);


            // Step 4: Send Meeting Details via Email
            const emailSubject = `📍 Site Visit Scheduled - Project ${project.projectId}`;
            const emailMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                    <div style="text-align: center;">
                        <img src="https://99squarewall.com/img/Logo-01.png" alt="99SquareWall" style="max-width: 150px; margin-bottom: 10px;">
                        <h2 style="color: #002FCA;">📍 Site Visit Confirmation</h2>
                    </div>

                    <div style="padding: 15px; background: #fff; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="color: #444;">🏡 Property Details</h3>
                        <p><strong>👨‍💼 Client Name:</strong> ${project.clientName || "Not Provided"}</p>
                        <p><strong>📍 Location:</strong> ${project.plotInformation.plotLocation || "Not Provided"}</p>
                        <p><strong>📅 Date:</strong> ${project.specifications.startDate ? new Date(project.specifications.startDate).toDateString() : "Not Provided"}</p>
                        <p><strong>🔗 Google Maps:</strong> <a href="${project.plotInformation.mapLink || "#"}" style="color: #007bff;">View Location</a></p>
                    </div>

                    <div style="padding: 15px; background: #fff; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="color: #444;">👤 Assigned Expert</h3>
                        <li>
                            👨‍💼 <strong>${assignedExecutive.username}</strong> - 📞
                            📞 <a href="tel:${assignedExecutive.mobile}" style="color: #007bff;">${assignedExecutive.mobile}</a>
                            📧 <a href="mailto:${assignedExecutive.email}" style="color: #007bff;">${assignedExecutive.email}</a>
                        </li>
                    </div>

                    <p style="font-size: 14px; color: #777; text-align: center; margin-top: 15px;">
                        If you have any questions, feel free to contact us at 
                        <a href="mailto:support@99squarewall.com" style="color: #007bff;">support@99squarewall.com</a>
                    </p>
                </div>
            `;

            // console.log(project.clientEmail);
            // console.log(assignedExecutives.map(item => item.email));

            // Send Email to Client
            await sendmail(project.clientEmail, emailSubject, emailMessage);

            // ✅ Send Email to Assigned Field Executive
            await sendmail(assignedExecutive.email, emailSubject, emailMessage);

            console.log(`📩 Meeting Details Email Sent to Client & Expert for Project ${project.projectId}`);
        }

    } catch (error) {
        console.error("❌ Error in cron job:", error);
    }
};

// Schedule the cron job to run every 10 minutes
const startCronJobs = () => {
    cron.schedule("*/10 * * * * *", assignNewLeads);
};

export default startCronJobs;