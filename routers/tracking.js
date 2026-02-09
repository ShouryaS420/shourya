import { Router } from "express";
import EmailEvent from "../models/EmailEvent.js";
import { ONE_PX_PNG } from "../utils/trackingPixel.js";
import { URL } from "url";

const r = Router();

// GET /t/o/:tid.png  -> log OPEN, return 1x1 PNG
r.get("/o/:tid.png", async (req, res) => {
    const { tid } = req.params;
    try {
        await EmailEvent.create({
            event: "open",
            trackingId: tid,
            ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip,
            ua: req.headers["user-agent"] || "",
            meta: { q: req.query || {} },
        });
    } catch (e) { /* don't block pixel */ }
    res.set("Content-Type", "image/png");
    // prevent downstream caches from reusing across different recipients
    res.set("Cache-Control", "no-store, private, max-age=0");
    return res.status(200).send(ONE_PX_PNG);
});

// GET /t/c/:tid  -> log CLICK, redirect ?u=<encodedURL>
r.get("/c/:tid", async (req, res) => {
    const { tid } = req.params;
    const u = req.query.u;
    // basic safety: only allow http/https and block javascript:
    try {
        const parsed = new URL(u);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("Bad url");
    } catch {
        return res.status(400).send("Invalid URL");
    }

    try {
        await EmailEvent.create({
            event: "click",
            trackingId: tid,
            ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip,
            ua: req.headers["user-agent"] || "",
            link: u,
        });
    } catch (e) { /* ignore */ }

    return res.redirect(302, u);
});

export default r;
