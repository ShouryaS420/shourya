import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { adminAuthConfig } from '../../config/adminAuthConfig.js';
import AdminSession from '../../models/adminAuth/AdminSession.js';

export function generateRefreshToken() {
    return randomBytes(32).toString('base64url');
}

export async function hashRefresh(token) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(token, salt);
}
export async function compareRefresh(token, hash) {
    return bcrypt.compare(token, hash);
}

export function setRefreshCookiePair(res, sessionId, token, maxAgeMs) {
    const v = `${sessionId}.${token}`;
    const opts = {
        httpOnly: true,
        secure: adminAuthConfig.isProd(),
        sameSite: 'strict',
        path: '/api/admin-auth',
        maxAge: maxAgeMs,
    };
    if (adminAuthConfig.COOKIE_DOMAIN) opts.domain = adminAuthConfig.COOKIE_DOMAIN;
    res.cookie(adminAuthConfig.ADMIN_REFRESH_COOKIE_NAME, v, opts);
}

export function clearRefreshCookie(res) {
    const opts = {
        httpOnly: true,
        secure: adminAuthConfig.isProd(),
        sameSite: 'strict',
        path: '/api/admin-auth',
    };
    if (adminAuthConfig.COOKIE_DOMAIN) opts.domain = adminAuthConfig.COOKIE_DOMAIN;
    res.clearCookie(adminAuthConfig.ADMIN_REFRESH_COOKIE_NAME, opts);
}

export async function createSession({ userId, refreshToken, deviceId, userAgent, ip }) {
    const refreshHash = await hashRefresh(refreshToken);
    const expiresAt = new Date(Date.now() + adminAuthConfig.refreshMs());
    const sess = await AdminSession.create({
        userId, refreshHash, deviceId, userAgent, ip, expiresAt, lastUsedAt: new Date(),
    });
    return sess; // caller will set cookie with sess._id + token
}

/** Load a session by id and verify token */
export async function verifySessionById(sessionId, token) {
    const sess = await AdminSession.findById(sessionId);
    if (!sess) return null;
    if (sess.revokedAt) return null;
    if (sess.expiresAt <= new Date()) return null;

    const ok = await compareRefresh(token, sess.refreshHash);
    if (!ok) return null;

    sess.lastUsedAt = new Date();
    await sess.save();
    return sess;
}

/** Revoke session */
export async function revokeSession(sessionId) {
    await AdminSession.findByIdAndUpdate(sessionId, { $set: { revokedAt: new Date() } });
}
