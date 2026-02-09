// server/utils/logActivity.js
import Project from '../models/ProjectDetails.js';

/**
 * Pushes an activity entry into Project.activityLogs (and saves).
 * @param {object|string} projectOrId - Project doc or _id
 * @param {object} payload - { type, name, description, actor, meta, date }
 */
export async function logActivity(projectOrId, {
    type = '',
    name = '',
    description = '',
    actor = {},
    meta = {},
    date = new Date(),
} = {}) {
    const project = typeof projectOrId === 'string'
        ? await Project.findById(projectOrId)
        : projectOrId;

    if (!project) return;

    project.activityLogs.push({ type, name, description, actor, meta, date });
    await project.save();
}
