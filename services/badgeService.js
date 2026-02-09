// services/badgeService.js

export function getBadgeFromSkillLevel(skillLevel) {
    const lvl = Number(skillLevel || 1);

    if (lvl === 1) {
        return {
            code: "BRONZE",
            label: "Bronze",
            rank: 1,
            color: "#CD7F32",
        };
    }

    if (lvl === 2) {
        return {
            code: "SILVER",
            label: "Silver",
            rank: 2,
            color: "#C0C0C0",
        };
    }

    if (lvl === 3) {
        return {
            code: "GOLD",
            label: "Gold",
            rank: 3,
            color: "#FFD700",
        };
    }

    if (lvl === 4) {
        return {
            code: "PLATINUM",
            label: "Platinum",
            rank: 4,
            color: "#8FD3F4",
        };
    }

    // fallback safety
    return {
        code: "BRONZE",
        label: "Bronze",
        rank: 1,
        color: "#CD7F32",
    };
}
