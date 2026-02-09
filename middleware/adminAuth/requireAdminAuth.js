import AdminUser from '../../models/adminAuth/AdminUser.js';
import { verifyAccessJwt } from '../../lib/adminAuth/jwt.js';

/**
 * Reads Bearer access token, verifies it, loads AdminUser and attaches:
 *   req.admin = { id, email, role, name, avatarUrl, userDoc }
 */
export async function requireAdminAuth(req, res, next) {
    try {
        const auth = req.headers['authorization'] || '';
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (!m) return res.status(401).json({ ok: false, error: 'missing_bearer' });

        const token = m[1];
        let payload;
        try {
            payload = verifyAccessJwt(token); // throws if invalid/expired
        } catch (err) {
            return res.status(401).json({ ok: false, error: 'invalid_or_expired' });
        }

        const user = await AdminUser.findById(payload.sub).lean();
        if (!user) return res.status(401).json({ ok: false, error: 'user_not_found' });
        if (user.status === 'suspended') {
            return res.status(403).json({ ok: false, error: 'suspended' });
        }

        req.admin = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
            avatarUrl: user.avatarUrl,
            userDoc: user,
        };
        next();
    } catch (err) {
        console.error('requireAdminAuth error:', err);
        res.status(500).json({ ok: false, error: 'server_error' });
    }
}
