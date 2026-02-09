// services/activityService.js
import Activity from '../models/Activity.js';

export async function logActivity({
    userId,
    projectId,
    type,
    title,
    details = '',
    actor = {},    // { id, name, role, avatarUrl, type }
    meta = {}      // any extra fields
}) {
    try {
        await Activity.create({ userId, projectId, type, title, details, actor, meta });
    } catch (e) {
        console.error('logActivity error:', e);
    }
}
