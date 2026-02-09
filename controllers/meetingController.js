import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

// Load service account key
const keyPath = path.resolve('service-account-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

// Initialize Google Auth
const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
});

// Create Google Calendar API instance
const calendar = google.calendar({ version: 'v3', auth });

// Create Google Meet and return link
export const createGoogleMeet = async (req, res) => {
    try {
        const { clientEmail, meetingDate, meetingTime } = req.body;

        // ✅ Validate input
        if (!clientEmail || !meetingDate || !meetingTime) {
            return res.status(400).json({ success: false, message: 'Missing required fields!' });
        }

        // Combine date and time into a Date object
        const startDateTime = new Date(`${meetingDate}T${meetingTime}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // 30 mins duration

        // Define event details
        const event = {
            summary: 'Design & Consultation Meeting',
            description: 'Meeting to discuss design options and client requirements.',
            start: {
                dateTime: format(startDateTime, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: format(endDateTime, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                timeZone: 'Asia/Kolkata',
            },
            attendees: [{ email: clientEmail }],
            conferenceData: {
                createRequest: {
                    requestId: 'meet' + Math.random().toString(36).substring(2, 15),
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        };

        // Insert event into Google Calendar
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            conferenceDataVersion: 1,
        });

        const meetLink = response.data.hangoutLink;
        console.log('Meeting Link:', meetLink);

        // ✅ Send response
        res.status(201).json({
            success: true,
            message: 'Google Meet created successfully!',
            meetLink,
            eventId: response.data.id,
            startTime: event.start.dateTime,
            endTime: event.end.dateTime,
        });
    } catch (error) {
        console.error('Error creating Google Meet:', error);
        res.status(500).json({ success: false, message: 'Failed to create Google Meet', error });
    }
};
