import cron from "node-cron";
import Project from "./models/ProjectDetails.js";
import VendorUsers from "./models/VendorUsers.js";
import { sendmail } from "./utils/sendmail.js";

// 🏢 Office Location Google Maps Link
const OFFICE_MAP_LINK = "https://maps.app.goo.gl/zjsZhwaJ3Ru3HRkCA";

const assignDesignExpert = async () => {
    console.log("🔄 Running Cron Job for Design Expert Assignment...");

    try {
        const projectsNeedingDesign = await Project.find({
            isDesignConsultation: true,
            // "designConsultationReport.assignedExpert": "",
        });

        if (projectsNeedingDesign.length === 0) {
            console.log("✅ No projects pending design expert assignment.");
            return;
        }

        const designExperts = await VendorUsers.find({ role: "Design Expert" });

        if (designExperts.length === 0) {
            console.log("❌ No Design Experts available.");
            return;
        }

        for (let i = 0; i < projectsNeedingDesign.length; i++) {
            const project = projectsNeedingDesign[i];
            const assignedExpert = designExperts[i % designExperts.length];

            // 🛠 Update designConsultationReport and assignedTeamMember
            project.designConsultationReport = {
                ...project.designConsultationReport,
                assignedExpert: assignedExpert._id
            };

            project.isDesignConsultation = false;

            // 🛠 Updated assignedTeamMember Structure
            const updatedAssignedTeamMembers = [
                ...(project.assignedTeamMember || []), // Keep existing members
                {
                    id: assignedExpert._id,
                    department: ["Design"],
                    assignedWork: "Design Consultation"
                }
            ];

            project.assignedTeamMember = updatedAssignedTeamMembers;

            await project.save();

            console.log(`✅ Assigned Design Expert ${assignedExpert.username} to Project ${project.projectId}`);

            // 📅 Extract Meeting Details
            const { meetingType, meetingDate, meetingTime } = project.designConsultationReport || {};
            const formattedDate = new Date(meetingDate).toLocaleDateString("en-IN", {
                weekday: "long", year: "numeric", month: "long", day: "numeric"
            });
            const formattedTime = new Date(meetingTime).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit", hour12: true
            });

            // 📧 Enhanced Email Template
            const emailSubject = `🎨 Design Expert Assigned for Project ${project.projectId}`;
            const emailMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                    <div style="text-align: center;">
                        <img src="https://99squarewall.com/img/Logo-01.png" alt="99SquareWall" style="max-width: 150px; margin-bottom: 10px;">
                        <h2 style="color: #002FCA;">🎨 Design Consultation Scheduled</h2>
                    </div>

                    <div style="padding: 15px; background: #fff; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="color: #444;">🏡 Project Details</h3>
                        <p><strong>👨‍💼 Client Name:</strong> ${project.clientName}</p>
                        <p><strong>📍 Location:</strong> ${project.clientCity}</p>
                        <p><strong>📅 Date:</strong> ${formattedDate}</p>
                        <p><strong>🕒 Time:</strong> ${formattedTime}</p>
                        <p><strong>📞 Meeting Type:</strong> ${meetingType}</p>
                        ${meetingType === "At Office" ? `
                            <p><strong>📍 Office Location:</strong> <a href="${OFFICE_MAP_LINK}" style="color: #007bff;">View on Google Maps</a></p>
                        ` : ""}
                    </div>

                    <div style="padding: 15px; background: #fff; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="color: #444;">👤 Assigned Expert</h3>
                        <ul style="list-style-type: none; padding: 0;">
                            <li><strong>👨‍💼 Name:</strong> ${assignedExpert.username}</li>
                            <li><strong>📞 Contact:</strong> <a href="tel:${assignedExpert.mobile}" style="color: #007bff;">${assignedExpert.mobile}</a></li>
                            <li><strong>📧 Email:</strong> <a href="mailto:${assignedExpert.email}" style="color: #007bff;">${assignedExpert.email}</a></li>
                        </ul>
                    </div>

                    <div style="padding: 15px; background: #fff; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="color: #444;">📋 Next Steps</h3>
                        <ul>
                            <li>The assigned design expert will contact you to confirm the meeting.</li>
                            <li>Please prepare any ideas or references you wish to discuss.</li>
                            <li>If you need to reschedule, please contact us at least 24 hours in advance.</li>
                        </ul>
                    </div>

                    <p style="text-align: center; color: #777;">Thank you for choosing 99SquareWall!</p>
                    <p style="font-size: 14px; color: #777; text-align: center; margin-top: 15px;">
                        If you have any questions, feel free to contact us at 
                        <a href="mailto:support@99squarewall.com" style="color: #007bff;">support@99squarewall.com</a>
                    </p>
                </div>
            `;

            await sendmail(project.clientEmail, emailSubject, emailMessage);
            await sendmail(assignedExpert.email, `New Project Assigned: ${project.projectId}`, emailMessage);

            console.log(`📩 Email sent to Client & Design Expert for Project ${project.projectId}`);
        }
    } catch (error) {
        console.error("❌ Error in Design Expert Assignment Cron Job:", error);
    }
};

// 🕒 Schedule the cron job to run every 10 minutes
const startDesignExpertCron = () => {
    cron.schedule("*/10 * * * * *", assignDesignExpert);
};

export default startDesignExpertCron;
