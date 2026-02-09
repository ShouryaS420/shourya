import 'dotenv/config';
import { app } from "./app.js";
import { config } from "dotenv";
import { connectDatabase } from "./config/database.js";
import express from 'express';
import startCronJobs from "./cronJobs.js";
// import startAssignRmCronJobs from "./AssignRelationshipManager.js";
import startDesignExpertCron from "./assignDesignExpertCron.js";
import startReassignRMToClientCronJobs from "./ReassignRMToClient.js";
import { initCron } from './cron/index.js';
import bodyParser from 'body-parser';
import startAssignRmCronJobs from './cron/startAssignRmCronJobs.js';
import path from 'path';
import fs from "fs";
import runPaymentReminderJob from './cron/paymentReminderWorker.js';
import { runWeeklyCareerEvaluation } from './crons/weeklyCareerEvalCron.js';
import cron from "node-cron";
import { runMonthlyCareerEvaluation } from './crons/monthlyCareerEvalCron.js';
import { seedLeadershipPolicies } from './seeds/seedLeadershipPolicies.js';

import { runLeadershipLifecycleCron } from "./cron/leadershipLifecycleCron.js";
import { runLeadershipReminders } from "./services/leadershipReminderService.js";
import LeadershipParticipationPolicy from './models/LeadershipParticipationPolicy.js';

config({
  path: "./config/config.env",
});

// Allow big JSON payloads (PDF base64)
app.use(bodyParser.json({ limit: "25mb", strict: true }));
app.use(bodyParser.urlencoded({ extended: true, limit: "25mb" }));

// Nice error for oversize payloads
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "PDF too large. Try smaller images or a lighter PDF.",
    });
  }
  next(err);
});

app.use(bodyParser.json({
  limit: "25mb",
  strict: true,
  verify: (req, res, buf) => {
    req.rawBody = buf; // needed for signature verification
  }
}));

// ✅ Agreements directory (same as generateSignedAgreementPdf)
const AGREEMENTS_DIR = path.join(process.cwd(), "storage", "agreements");
if (!fs.existsSync(AGREEMENTS_DIR)) {
  fs.mkdirSync(AGREEMENTS_DIR, { recursive: true });
}

// ✅ Serve /agreements/... as static files
app.use("/agreements", express.static(AGREEMENTS_DIR));

console.log('AGREEMENTS_DIR', AGREEMENTS_DIR)

connectDatabase();
// startCronJobs();
// // startAssignRmCronJobs();
// startDesignExpertCron();
// startReassignRMToClientCronJobs();
// startAssignRmCronJobs();
// runPaymentReminderJob();
// initCron();
// await seedLeadershipPolicies();

// // Every 5 minutes – lifecycle transitions
// setInterval(async () => {
//   await runLeadershipLifecycleCron();
// }, 5 * 60 * 1000);

// Every 1 hour – reminders
setInterval(async () => {
  await runLeadershipReminders();
}, 60 * 60 * 1000);

const CAREER_EVAL_TEST_MODE = process.env.CAREER_EVAL_TEST_MODE === "true";

// NOTE: node-cron supports 5-field by default. Seconds support depends on version/config.
// Safer: use every minute for test. If you want seconds, use setInterval (below).

// if (CAREER_EVAL_TEST_MODE) {
//   console.log("[CAREER] TEST MODE enabled: running weekly evaluation every 1 minute (dryRun optional).");

//   cron.schedule(
//     "* * * * *", // every minute
//     async () => {
//       try {
//         // For testing, use a fixed window so repeated runs don’t keep moving the period.
//         // Also supports dryRun if you pass { dryRun: true } (recommended first).
//         await runWeeklyCareerEvaluation({
//           from: process.env.CAREER_EVAL_TEST_FROM || "2026-01-13",
//           to: process.env.CAREER_EVAL_TEST_TO || "2026-01-19",
//           dryRun: process.env.CAREER_EVAL_DRY_RUN === "true",
//           periodLabel: process.env.CAREER_EVAL_TEST_PERIOD || "TEST-WEEK",
//         });
//       } catch (e) {
//         console.error("[CAREER][TEST] weekly evaluation failed:", e);
//       }
//     },
//     { timezone: "Asia/Kolkata" }
//   );

//   // If you truly need “every 10 seconds”, do this instead of cron:
//   // const intervalMs = Number(process.env.CAREER_EVAL_TEST_INTERVAL_MS || 10000);
//   // setInterval(async () => {
//   //   try {
//   //     await runWeeklyCareerEvaluation({
//   //       from: process.env.CAREER_EVAL_TEST_FROM || "2026-01-13",
//   //       to: process.env.CAREER_EVAL_TEST_TO || "2026-01-19",
//   //       dryRun: process.env.CAREER_EVAL_DRY_RUN === "true",
//   //       periodLabel: process.env.CAREER_EVAL_TEST_PERIOD || "TEST-WEEK",
//   //     });
//   //   } catch (e) {
//   //     console.error("[CAREER][TEST] weekly evaluation failed:", e);
//   //   }
//   // }, intervalMs);
// } else {
//   console.log("[CAREER] Production schedule: Sunday 23:30 IST");

//   cron.schedule(
//     "30 23 * * 0", // Sunday 23:30
//     async () => {
//       try {
//         await runWeeklyCareerEvaluation();
//       } catch (e) {
//         console.error("[CAREER][WEEKLY] cron failed:", e);
//       }
//     },
//     { timezone: "Asia/Kolkata" }
//   );
// }

// Monthly career evaluation — 1st day of month at 00:30 IST
// cron.schedule(
//   "30 0 1 * *",
//   async () => {
//     try {
//       await runMonthlyCareerEvaluation();
//     } catch (err) {
//       console.error("[CAREER][MONTHLY] cron failed:", err?.message || err);
//     }
//   },
//   { timezone: "Asia/Kolkata" }
// );

export async function ensureLeadershipParticipationPolicy() {
  const count = await LeadershipParticipationPolicy.countDocuments();
  if (count === 0) {
    await LeadershipParticipationPolicy.create({
      minDaysParticipation: 2,
      enforceNoOverlap: true,
      enforceSameSite: false,
      maxConcurrentPrograms: 1,
    });
    console.log("[SEED] LeadershipParticipationPolicy created");
  }
}

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static('uploads'));

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log("Server is running on port " + process.env.PORT);
});