// utils/sendmailWithAttachments.js
import { createTransport } from "nodemailer";

export async function sendMailWithAttachments({
    to,
    subject,
    html,
    attachments = [],
    headers = {},
    from, // optional override
}) {
    const transport = createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const mailFrom = from || process.env.SMTP_USER;

    await transport.sendMail({
        from: mailFrom,
        to,
        subject,
        html,
        attachments,
        headers,
    });
}
