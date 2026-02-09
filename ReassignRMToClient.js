import cron from "node-cron";
import Project from './models/ProjectDetails.js'; // Your project schema
import VendorUsers from "./models/VendorUsers.js"; // Your vendor (team) schema
import { sendmail } from "./utils/sendmail.js";
import User from "./models/User.js";

let currentRMIndex = 0; // This will hold the index of the last assigned RM

const ReassignRMToClient = async () => {
    console.log("🔄 Running Cron Job for Relationship Manager Assignment...");

    try {
        // Step 1: Find Projects where 'constructionDetails' has any item with 'status' as "Connecting RM"
        const projectsWithConnectingRMStatus = await User.find({
            "constructionDetails.status": "Connecting RM"
        });

        if (projectsWithConnectingRMStatus.length === 0) {
            console.log("✅ No 'Connecting RM' Status projects found.");
            return;
        }

        // Step 2: Find Available Relationship Managers
        const relationshipManagers = await VendorUsers.find({ role: "Relationship Manager" });

        if (relationshipManagers.length === 0) {
            console.log("❌ No Customer Support Relationship Managers available.");
            return;
        }

        // Step 3: Fetch User Details and assign RM if no 'Customer Support' member exists
        for (const project of projectsWithConnectingRMStatus) {
            const userDetails = await User.findOne({ userId: project.userId });

            // Check if a 'Customer Support' team member is already assigned
            const hasCustomerSupport = userDetails.assignedTeamMember.some(member => member.department.includes('Customer Support'));

            if (!hasCustomerSupport) {
                const rm = relationshipManagers[currentRMIndex];

                // Update the User model
                await User.updateOne(
                    { _id: userDetails.id },
                    {
                        $set: {
                            "assignedTeamMember": [{
                                id: rm._id,
                                department: 'Customer Support',
                                assignedWork: `Handle Project ${project.projectId}`
                            }],
                            "constructionDetails.$[elem].status": "RM Assigned" // Update status to "RM Assigned"
                        }
                    },
                    { arrayFilters: [{ "elem.status": "Connecting RM" }] } // Ensure we only update the correct element in the array
                );

                // Update the User model
                await Project.updateOne(
                    { projectId: project.userId },
                    {
                        $set: {
                            "constructionDetails.$[elem].status": "RM Assigned" // Update status to "RM Assigned"
                        }
                    },
                    { arrayFilters: [{ "elem.status": "Connecting RM" }] } // Ensure we only update the correct element in the array
                );

                // Assign RM Task in Project Model
                const projectDetails = await Project.findOne({ projectId: project.userId });

                if (projectDetails) {
                    // Add RM Task
                    projectDetails.assignedTasks.push({
                        taskName: "Follow up with Client for Proposal Approval",
                        assignedTo: rm.username,
                        status: "Pending",
                        assignedDate: new Date(),
                    });

                    // Update Task Progress
                    const taskProgress = projectDetails.taskProgress.find(stage => stage.stageName === "Proposal Approval");

                    if (taskProgress) {
                        taskProgress.progress = "Ongoing";
                        taskProgress.tasks.push({ taskName: "Follow up with Client", status: "Pending" });
                    } else {
                        projectDetails.taskProgress.push({
                            stageName: "Proposal Approval",
                            progress: "Ongoing",
                            tasks: [{ taskName: "Follow up with Client", status: "Pending" }]
                        });
                    }

                    await projectDetails.save();
                }

                console.log(`✅ Assigned RM (${rm.username}) to Project ID ${project.projectId}`);

                // Send Emails
                await sendEmails(projectDetails, userDetails, rm);

                // Update index for next assignment
                currentRMIndex = (currentRMIndex + 1) % relationshipManagers.length;
            } else {
                console.log(`✅ Project ID ${project._id} already has a Customer Support team member assigned.`);
            }
        }

    } catch (error) {
        console.error("❌ Error in cron job:", error);
    }
};

// 📩 **Send Emails to Client & RM**
const sendEmails = async (project, user, rm) => {
    const clientEmailSubject = `📢 Proposal Approval - Next Steps`;
    const clientEmailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
            <div style="text-align: center;">
                <img src="https://99squarewall.com/img/Logo-01.png" alt="99SquareWall" style="max-width: 150px; margin-bottom: 10px;">
                <h2 style="color: #002FCA;">📢 Proposal Approval - Next Steps</h2>
            </div>

            <p>Dear <strong>${user.username}</strong>,</p>
            <p>We are pleased to inform you that your project proposal is ready for approval. Your dedicated Relationship Manager, <strong>${rm.username}</strong>, will assist you with any queries you may have.</p>
            <h3 style="color: #444;">📅 Next Steps:</h3>
            <ul>
                <li>📞 Your RM will call you for a final discussion.</li>
                <li>📜 Review and approve the proposal.</li>
                <li>✅ Proceed with the next phase of your project.</li>
            </ul>
            
            <h3 style="color: #444;">👤 Your Assigned RM:</h3>
            <p><strong>${rm.username}</strong> | 📞 <a href="tel:${rm.mobile}" style="color: #007bff;">${rm.mobile}</a> | 📧 <a href="mailto:${rm.email}" style="color: #007bff;">${rm.email}</a></p>

            <p>For more details, download our app:</p>
            <div style="text-align: center;">
                <a href="https://play.google.com/store/apps/details?id=com.nitinsuryawanshi.constructionapp&hl=en" target="_blank">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play Store" style="max-width: 150px; margin: 5px;">
                </a>
                <a href="https://apps.apple.com/in/app/99squarewall-home-construction/id6741794757" target="_blank">
                    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="App Store" style="max-width: 150px; margin: 5px;">
                </a>
            </div>

            <p style="text-align:center; color:#777; margin-top:15px;">For any assistance, contact us at <a href="mailto:support@99squarewall.com" style="color: #007bff;">support@99squarewall.com</a></p>
        </div>
    `;

    // Email to RM
    const rmEmailSubject = `📌 New Task Assigned: Proposal Approval Follow-Up`;
    const rmEmailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
            <div style="text-align: center;">
                <img src="https://99squarewall.com/img/Logo-01.png" alt="99SquareWall" style="max-width: 150px; margin-bottom: 10px;">
                <h2 style="color: #002FCA;">📌 New Task Assigned</h2>
            </div>

            <p>Dear <strong>${rm.username}</strong>,</p>
            <p>You have been assigned a new task to follow up with the client regarding the proposal approval for <strong>${user.username}</strong>.</p>
            <h3 style="color: #444;">🔹 Task Details:</h3>
            <ul>
                <li>📞 Contact the client: <a href="tel:${user.mobile}" style="color: #007bff;">${user.mobile}</a></li>
                <li>📜 Guide them through the proposal approval process.</li>
                <li>✅ Update the project status after confirmation.</li>
            </ul>

            <p>Please ensure you complete this task at the earliest.</p>
        </div>
    `;

    // Send Emails
    await sendmail(user.email, clientEmailSubject, clientEmailMessage);
    await sendmail(rm.email, rmEmailSubject, rmEmailMessage);

    console.log(`📩 Email sent to ${user.username} and ${rm.username}`);
};

// Schedule the cron job to run every 10 minutes
const startReassignRMToClientCronJobs = () => {
    cron.schedule("*/10 * * * * *", ReassignRMToClient);
};

export default startReassignRMToClientCronJobs;
