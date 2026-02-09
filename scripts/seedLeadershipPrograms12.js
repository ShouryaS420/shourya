import mongoose from "mongoose";
import LeadershipProgram from "../models/LeadershipProgram.js";

function addHours(n) {
    return new Date(Date.now() + n * 60 * 60 * 1000);
}

function addDays(n) {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function main() {
    const uri = process.env.MONGO_URI || process.env.MONGO_URL;
    if (!uri) throw new Error("Missing MONGO_URI (or MONGO_URL)");
    await mongoose.connect(uri);

    // Delete previously seeded programs
    await LeadershipProgram.deleteMany({ seedTag: "LADDER_V1" });

    // NOTE: stage is REQUIRED in your schema
    const programs = [
        // STANDARD (SILVER+)
        {
            title: "Standard Shuttering Setup",
            stage: "SHUTTERING",
            difficulty: "STANDARD",
            requiredTier: "SILVER",
            requiredSkills: ["shuttering_assist", "scaffolding"],
            leaderBonus: 800,
            memberBonus: 300,
        },
        {
            title: "Standard Scaffolding Safety",
            stage: "SHUTTERING",
            difficulty: "STANDARD",
            requiredTier: "SILVER",
            requiredSkills: ["scaffolding"],
            leaderBonus: 700,
            memberBonus: 250,
        },
        {
            title: "Standard Material Flow",
            stage: "SHUTTERING",
            difficulty: "STANDARD",
            requiredTier: "SILVER",
            requiredSkills: ["material_handling"],
            leaderBonus: 600,
            memberBonus: 200,
        },

        // HARD (GOLD+)
        {
            title: "Hard Bar Bending Sprint",
            stage: "REBAR",
            difficulty: "HARD",
            requiredTier: "GOLD",
            requiredSkills: ["bar_bending"],
            leaderBonus: 1200,
            memberBonus: 450,
        },
        {
            title: "Hard Shuttering Alignment",
            stage: "SHUTTERING",
            difficulty: "HARD",
            requiredTier: "GOLD",
            requiredSkills: ["shuttering"],
            leaderBonus: 1100,
            memberBonus: 400,
        },
        {
            title: "Hard Slab Prep & Pour",
            stage: "SLAB",
            difficulty: "HARD",
            requiredTier: "GOLD",
            requiredSkills: ["slab_work", "concrete_pour"],
            leaderBonus: 1400,
            memberBonus: 500,
        },

        // CRITICAL (PLATINUM+)
        {
            title: "Critical Slab Deadline Program",
            stage: "SLAB",
            difficulty: "CRITICAL",
            requiredTier: "PLATINUM",
            requiredSkills: ["slab_work", "concrete_pour", "quality_check"],
            leaderBonus: 2000,
            memberBonus: 700,
        },
        {
            title: "Critical Zero Rework Week",
            stage: "QC",
            difficulty: "CRITICAL",
            requiredTier: "PLATINUM",
            requiredSkills: ["quality_check", "rework_prevention"],
            leaderBonus: 1800,
            memberBonus: 650,
        },
        {
            title: "Critical Finishing Excellence",
            stage: "FINISHING",
            difficulty: "CRITICAL",
            requiredTier: "PLATINUM",
            requiredSkills: ["finishing", "quality_check"],
            leaderBonus: 1900,
            memberBonus: 680,
        },

        // “Elite” mapped as CRITICAL if you only have 3 difficulty enums
        {
            title: "Elite Multi-Trade Delivery",
            stage: "SLAB",
            difficulty: "CRITICAL",
            requiredTier: "DIAMOND",
            requiredSkills: ["bar_bending", "shuttering", "slab_work", "quality_check"],
            leaderBonus: 2600,
            memberBonus: 900,
        },
        {
            title: "Elite Plaster + Tile Integration",
            stage: "FINISHING",
            difficulty: "CRITICAL",
            requiredTier: "DIAMOND",
            requiredSkills: ["plastering", "tile_work", "quality_check"],
            leaderBonus: 2400,
            memberBonus: 850,
        },
        {
            title: "Elite Quality Marshal Program",
            stage: "QC",
            difficulty: "CRITICAL",
            requiredTier: "DIAMOND",
            requiredSkills: ["quality_check", "rework_prevention"],
            leaderBonus: 2300,
            memberBonus: 800,
        },
    ];

    // Windows:
    // - application closes quickly for testing: 5 minutes
    // - team formation closes: 60 minutes
    // - due: +3 days
    const docs = programs.map((p) => ({
        title: p.title,
        stage: p.stage,
        difficulty: p.difficulty,
        requiredSkills: p.requiredSkills,
        requiredTier: p.requiredTier,

        rewardPolicy: { leaderBonus: p.leaderBonus, memberBonus: p.memberBonus },
        teamRules: { teamSizeMin: 3, teamSizeMax: 6 },

        status: "PUBLISHED",

        startAt: addHours(0.2),                 // ~12 minutes from now
        applicationCloseAt: addHours(0.08),     // ~5 minutes from now (fast test)
        teamFormationCloseAt: addHours(1),      // 1 hour from now
        dueAt: addDays(3),                      // 3 days from now

        seedTag: "LADDER_V1",
    }));

    const inserted = await LeadershipProgram.insertMany(docs);
    console.log(`Seeded ${inserted.length} programs (LADDER_V1)`);

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
