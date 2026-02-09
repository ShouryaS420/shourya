import express from "express";
import { interaktWebhook } from "../controllers/interaktWebhookController.js";

const router = express.Router();

// 🔔 Router-level logging so you always know if Interakt is reaching this server
router.use((req, _res, next) => {
    console.log("🔔 [WEBHOOK HIT]", {
        method: req.method,
        path: req.originalUrl,
        time: new Date().toISOString(),
        headers: {
            "interakt-signature": req.headers["interakt-signature"],
            "content-type": req.headers["content-type"],
        },
    });
    next();
});

router.get("/interakt", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

router.post("/interakt", interaktWebhook);

export default router;
