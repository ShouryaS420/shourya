import nodemailer from 'nodemailer';
import { adminAuthConfig } from '../../config/adminAuthConfig.js';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465, // true for 465
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendMail({ to, subject, html, text }) {
    const info = await transporter.sendMail({
        from: adminAuthConfig.MAIL_FROM,
        to, subject,
        text: text || html?.replace(/<[^>]+>/g, ' '),
        html,
    });
    return info;
}
