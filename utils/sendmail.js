// utils/sendmail.js
import { createTransport } from "nodemailer";

export const sendmail = async (opts = {}) => {
    const {
        to,
        email,
        subject,
        html,
        htmlContent,
        text,
    } = opts;

    const recipient = to || email;
    if (!recipient) {
        throw new Error("sendmail: No recipient email provided");
    }

    const transport = createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transport.sendMail({
        from: process.env.SMTP_USER,
        to: recipient,
        subject: subject || "",
        html: html || htmlContent || "",
        text: text || undefined,
    });
};
