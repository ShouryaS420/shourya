// utils/workerBadge.js

export function computeWorkerBadge({ skillCategory, skillLevel }) {
    let tier = "BRONZE";
    let title = "Starter";

    if (skillLevel === 2) {
        tier = "SILVER";
        title = "Reliable";
    } else if (skillLevel === 3) {
        tier = "GOLD";
        title = "Pro";
    } else if (skillLevel === 4) {
        tier = "PLATINUM";
        title = "Elite";
    }

    return {
        tier,            // BRONZE | SILVER | GOLD | PLATINUM
        title,           // Starter | Reliable | Pro | Elite
        skillCategory,   // HELPER | SEMISKILLED | SKILLED
        level: skillLevel,
        label: `${skillCategory} • ${tier}`,   // "SKILLED • GOLD"
    };
}
