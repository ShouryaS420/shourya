import AdminUser from '../../models/adminAuth/AdminUser.js';
import { adminAuthConfig } from '../../config/adminAuthConfig.js';
import VendorUsers from '../../models/VendorUsers.js';

// ⚠️ adjust this import to your real vendor/employee model path

/**
 * Resolve role for dashboard access from email.
 * Returns: 'founder' | 'admin' | 'employee' | null
 */
export async function resolveRoleByEmail(email) {
    const norm = String(email || '').trim().toLowerCase();
    if (!norm) return null;

    // founder always allowed
    if (adminAuthConfig.FOUNDER_EMAIL && norm === adminAuthConfig.FOUNDER_EMAIL.toLowerCase()) {
        return 'founder';
    }

    // else look up in Vendor/Employee directory
    const vendor = await VendorUsers.findOne({ email: norm }).lean();
    if (!vendor) return null;

    // map your vendor roles to dashboard roles
    const r = String(vendor.role || '').toLowerCase();
    if (r === 'admin' || r === 'manager' || r === 'owner') return 'admin';
    return 'employee';
}

/**
 * Upsert an AdminUser (dashboard facade) mirroring vendor profile.
 * Keeps AdminUser minimal and decoupled from operational Vendor.
 */
export async function upsertAdminUserByEmail(email, { name, avatarUrl, googleId, role }) {
    const norm = String(email || '').trim().toLowerCase();
    if (!norm) throw new Error('email required');

    const doc = await AdminUser.findOneAndUpdate(
        { email: norm },
        {
            $set: {
                email: norm,
                name: name || undefined,
                avatarUrl: avatarUrl || undefined,
                googleId: googleId || undefined,
                role: role || 'employee',
                status: 'active',
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc;
}
