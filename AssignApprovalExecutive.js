import cron from 'node-cron';
import ProjectDetails from './models/ProjectDetails';
import VendorUsers from './models/VendorUsers';

// CRON job scheduled to run every hour (adjust timing as needed)
cron.schedule('0 * * * *', async () => {
    try {
        const projects = await ProjectDetails.find({
            'constructionDetails.status': 'Newly Requested',
            'constructionDetails.requested': true
        });

        for (const project of projects) {
            const exec = await VendorUsers.findOne({
                department: 'Package Approval Department',
                role: 'Approval Manager'
            });

            if (exec) {
                // Assign the executive to the project
                project.assignedTo = exec._id.toString();
                project.assignedDate = new Date();
                await project.save();

                console.log(`Assigned executive ${exec.username} to project ${project.projectId}`);
            }
        }
    } catch (error) {
        console.error('Error running the CRON job:', error);
    }
});

console.log('CRON job is set to run every hour.');
