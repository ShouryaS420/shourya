import jwt from 'jsonwebtoken';
import { adminAuthConfig } from '../../config/adminAuthConfig.js';

/** Access JWT (short-lived) */
export function signAccessJwt(payload) {
    // payload: { sub, email, role, name?, avatarUrl? }
    return jwt.sign(payload, adminAuthConfig.ADMIN_JWT_SECRET, {
        expiresIn: adminAuthConfig.ADMIN_JWT_ACCESS_TTL,
        issuer: '99squarewall-dashboard',
        audience: 'dashboard',
    });
}

export function verifyAccessJwt(token) {
    return jwt.verify(token, adminAuthConfig.ADMIN_JWT_SECRET, {
        issuer: '99squarewall-dashboard',
        audience: 'dashboard',
    });
}
