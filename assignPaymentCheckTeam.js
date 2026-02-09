import cron from "node-cron";
import Project from "./models/ProjectDetails.js";
import VendorUsers from "./models/VendorUsers.js";
import { sendmail } from "./utils/sendmail.js";

const assignDesignExpert = async () => {
    console.log("🔄 Running Cron Job for Design Expert Assignment...");

    try {
        const projectsNeedingDesign = await Project.find({
            status: "Won",
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

    } catch (error) {
        console.error("❌ Error in Design Expert Assignment Cron Job:", error);
    }
};

// 🕒 Schedule the cron job to run every 10 minutes
const startDesignExpertCron = () => {
    cron.schedule("*/10 * * * * *", assignDesignExpert);
};

export default startDesignExpertCron;
