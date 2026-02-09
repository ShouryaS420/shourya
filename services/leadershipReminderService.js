// services/leadershipReminderService.js
import LeadershipProgram from "../models/LeadershipProgram.js";
import LeadershipAssignment from "../models/LeadershipAssignment.js";

function hoursBetween(a, b) {
    return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

export async function runLeadershipReminders() {
    const now = new Date();

    // Reminder: due in next 24 hours
    const dueSoon = await LeadershipProgram.find({
        status: "IN_PROGRESS",
        dueAt: { $gte: now, $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
    }).lean();

    for (const p of dueSoon) {
        const asg = await LeadershipAssignment.findOne({ programId: p._id }).lean();
        if (!asg) continue;

        // Here you can plug WhatsApp / push / SMS later
        console.log(
            `[REMINDER] Program ${p._id} due soon. Notify leader ${asg.leaderId}`
        );
    }

    // Reminder: team formation pending for >48 hours
    const tfPending = await LeadershipProgram.find({
        status: "TEAM_FORMATION",
    }).lean();

    for (const p of tfPending) {
        const hours = hoursBetween(new Date(p.updatedAt), now);
        if (hours >= 48) {
            const asg = await LeadershipAssignment.findOne({ programId: p._id }).lean();
            if (!asg) continue;

            console.log(
                `[REMINDER] Team formation pending for program ${p._id}. Notify leader ${asg.leaderId}`
            );
        }
    }
}
