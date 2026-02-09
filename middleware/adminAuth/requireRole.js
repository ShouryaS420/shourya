/**
 * Guard by role.
 * Usage:
 *   r.get('/admin-only', requireAdminAuth, requireRole('admin','founder'), handler)
 */
export function requireRole(...allowed) {
    const allowedSet = new Set(allowed);
    return (req, res, next) => {
        const role = req.admin?.role;
        if (!role) return res.status(401).json({ ok: false, error: 'unauthenticated' });
        if (!allowedSet.has(role)) return res.status(403).json({ ok: false, error: 'forbidden' });
        next();
    };
}
