import RaiseTicket from "../models/RaiseTicket.js";
import { sendmail } from "../utils/sendmail.js";
import { logActivity } from '../utils/logActivity.js';
import Project from '../models/ProjectDetails.js';

// Function to generate an 8-digit numeric ticket ID
function generateTicketId() {
    return Math.floor(10000000 + Math.random() * 90000000);
}

export const createRaiseTicket = async (req, res) => {
    try {

        const { mainUserID, mainIssue, subIssue, describeIssue, contactEmail, issueImage, userName, userEmail, userMobile, } = req.body;
        const ticketId = generateTicketId();

        // Validation: Check if any of the required fields are empty
        if (!mainIssue || !subIssue || !describeIssue) {
            return res.status(400).json({ message: 'All fields must be filled.', success: false });
        }

        const newRaiseTicket = new RaiseTicket({
            mainUserID,
            ticketId,
            mainIssue,
            subIssue,
            describeIssue,
            contactEmail,
            issueImage,
            userName,
            userEmail,
            userMobile,
            conversation: [
                {
                    name: userName,
                    message: describeIssue,
                    issuedImage: issueImage
                }
            ]
        });

        const submittedRaiseTicket = await newRaiseTicket.save();

        // 🔔 Activity on the client’s project (projectId === mainUserID)
        const proj = await Project.findOne({ projectId: mainUserID });
        await logActivity(proj, {
            type: 'ticket.created',
            name: `Ticket #${ticketId} Created`,
            description: `${mainIssue} · ${subIssue}`,
            actor: { name: userName || 'Client', actorType: 'client' },
            meta: { ticketId: newRaiseTicket._id }
        });

        const emailHtml = `Hello ${userName},\n\nThank you for contacting us. Your issue has been registered with Ticket ID: ${ticketId}. We will address your issue as soon as possible.\n\nIssue Description:\n${describeIssue}\n\nPlease do not send duplicate tickets as this will not reduce response time.\n\nRegards,\nYour Support Team`;
        await sendmail(userEmail, `Your ticket ID: ${ticketId} - Issue Submission Confirmation`, emailHtml);

        res.status(200).json({ success: true, message: "Ticket submitted successfully", submittedRaiseTicket: submittedRaiseTicket, });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message, success: false });
    }
}

export const getRaisedTicketDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const details = await RaiseTicket.find({ mainUserID: id });
        res.status(200).json(details);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
    }
};

export const getRaisedTicketDetailsByID = async (req, res) => {
    const { id } = req.params;
    try {
        const details = await RaiseTicket.findById(id);
        res.status(200).json(details);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { id, message, name } = req.body;

        // Log incoming data for debugging (if needed in development)
        console.log('Request Params:', req.params);
        console.log('Request Body:', req.body);

        // Find the ticket by ID
        const details = await RaiseTicket.findById(id);

        // Check if the ticket exists
        if (!details) {
            return res.status(404).json({
                message: 'Ticket not found.',
                success: false
            });
        }

        // Add the new conversation entry
        details.conversation.push({
            message,
            name
        });

        // 🔔 Activity on the project timeline
        const project = await Project.findOne({ projectId: details.mainUserID });
        await logActivity(project, {
            type: 'ticket.message',
            name: `Ticket #${details.ticketId} Message`,
            description: `${name}: ${message}`,
            actor: { name, actorType: 'employee' }, // or detect client/employee if you have that info here
            meta: { ticketId: details._id }
        });

        // Save the updated ticket
        await details.save();

        // Respond with success
        res.status(200).json({
            success: true,
            message: "Conversation added successfully."
        });

    } catch (error) {
        // Respond with error details
        res.status(500).json({
            message: 'Server error',
            error: error.message,
            success: false
        });
    }
}