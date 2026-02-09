// controllers/ProjectClientView.js (or add at bottom of your existing Project controller)
import Project from '../models/ProjectDetails.js';
import User from '../models/User.js';
import VendorUsers from '../models/VendorUsers.js';

const mapProjectStatusLabel = (status) => {
    switch (status) {
        case 'agreement_pending': return 'Agreement Pending';
        case 'agreement_sent': return 'Agreement Sent';
        case 'agreement_accepted': return 'Agreement Accepted';
        case 'project_started': return 'Project Started';
        case 'estimate_pending': return 'Estimate Pending';
        default: return status || 'Pending';
    }
};

/**
 * GET /api/client/my-project
 * Auth: isAuthenticated (client JWT)
 *
 * Returns a trimmed ProjectDetails payload for the mobile app.
 */
export const getMyProjectDetails = async (req, res) => {
    try {
        const clientId = req.user?._id;
        if (!clientId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // 1) Find latest project for this client
        const project = await Project
            .findOne({ clientId })
            .sort({ createdAt: -1 })
            .lean();

        if (!project) {
            return res.status(404).json({ success: false, message: 'No project found for this client' });
        }

        // 2) Load client for some details
        const client = await User.findById(clientId).lean();

        // 3) Pick latest constructionDetails row (most recent package/quotation)
        const latestConstruction = Array.isArray(project.constructionDetails) && project.constructionDetails.length
            ? project.constructionDetails[project.constructionDetails.length - 1]
            : null;

        // 4) Try to resolve RM (Customer Support) from assignedTeamMember
        let rmUser = null;
        const rmEntry = (project.assignedTeamMember || []).find(m =>
            Array.isArray(m.department) && m.department.includes('Customer Support')
        );
        if (rmEntry?.id) {
            rmUser = await VendorUsers.findById(rmEntry.id).lean();
        }

        // 5) Plot info
        const plot = project.plotInformation || {};
        const siteVisit = project.siteVisitReportDetails || {};
        const designCons = project.designConsultationReport || {};

        const dto = {
            projectId: project.projectId,
            projectTitle: project.projectTitle || project.projectId,
            status: project.status,
            statusLabel: mapProjectStatusLabel(project.status),
            currentPhase: project.currentPhase || '-',
            progress: project.progress || '0%',

            city: project.city || project.clientCity || '',
            state: project.state || '',
            siteAddress: project.siteAddress || plot.plotLocation || '',

            contractValue: typeof project.contractValue === 'number'
                ? project.contractValue
                : null,

            plot: {
                areaOfPlot: plot.areaOfPlot || '',
                length: plot.length || '',
                breadth: plot.breadth || '',
                plotLocation: plot.plotLocation || '',
            },

            packageInfo: latestConstruction ? {
                selectedPackage: latestConstruction.selectedPackage || '',
                configurationName: latestConstruction.configurationName || '',
                plotArea: latestConstruction.plotArea || '',
                finalPackageCost: latestConstruction.finalPackageCost || latestConstruction.totalPackageCost || '',
                stage: latestConstruction.stage || '',
                status: latestConstruction.status || '',
            } : null,

            meetings: {
                proposalApproval: {
                    hasMeeting: !!latestConstruction?.meetingDate,
                    callCompleted: !!latestConstruction?.callCompleted,
                    meetingType: latestConstruction?.meetingType || null,
                    meetingDate: latestConstruction?.meetingDate || null,
                    meetingTime: latestConstruction?.meetingTime || null,
                    assignedRM: latestConstruction?.assignedRM || (rmUser?._id?.toString() || null),
                    officeLocationUrl: latestConstruction?.officeLocation || undefined,
                },
                designConsultation: {
                    isDone: !!project.isDesignConsultation,
                    meetingType: designCons.meetingType || null,
                    meetingDate: designCons.meetingDate || null,
                    meetingTime: designCons.meetingTime || null,
                },
                siteVisit: {
                    isSiteVisit: !!project.isSiteVisit,
                    status: siteVisit.status || '',
                    assignedExpert: siteVisit.assignedExpert || null,
                    visitCompleted: !!siteVisit.visitCompleted,
                },
            },

            agreement: project.agreement,

            client: {
                name: client?.username || client?.fullName || client?.name || '',
                email: client?.email || '',
                mobile: client?.mobile || '',
            },

            rm: rmUser ? {
                id: rmUser._id.toString(),
                name: rmUser.username || rmUser.name || '',
                email: rmUser.email || '',
            } : null,
        };

        return res.status(200).json({ success: true, project: dto });
    } catch (err) {
        console.error('getMyProjectDetails error:', err);
        return res.status(500).json({ success: false, message: `server error: ${err.message}` });
    }
};
