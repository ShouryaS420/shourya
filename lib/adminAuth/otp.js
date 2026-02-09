import bcrypt from 'bcryptjs';
import OtpChallenge from '../../models/adminAuth/OtpChallenge.js';

export function generateSixDigitCode() {
    const n = Math.floor(Math.random() * 1000000);
    return n.toString().padStart(6, '0');
}

export async function hashOtp(code) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(code, salt);
}

export async function createOtpChallenge(email, ttlMs = 5 * 60 * 1000) {
    const code = generateSixDigitCode();
    const codeHash = await hashOtp(code);
    const expiresAt = new Date(Date.now() + ttlMs);
    const doc = await OtpChallenge.create({
        email: String(email).trim().toLowerCase(),
        codeHash,
        purpose: 'login',
        expiresAt,
        attempts: 0,
    });
    return { doc, code }; // caller emails this code
}

export async function verifyAndConsumeOtp(email, code) {
    const norm = String(email).trim().toLowerCase();
    const now = new Date();

    const chal = await OtpChallenge.findOne({
        email: norm,
        purpose: 'login',
        consumedAt: { $exists: false },
        expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    if (!chal) return { ok: false, reason: 'not_found_or_expired' };

    if (chal.attempts >= 5) return { ok: false, reason: 'too_many_attempts' };

    chal.attempts += 1;
    const match = await bcrypt.compare(code, chal.codeHash);

    if (!match) {
        await chal.save();
        return { ok: false, reason: 'invalid_code' };
    }

    chal.consumedAt = now;
    await chal.save();
    return { ok: true };
}
