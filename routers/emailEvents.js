import { Router } from "express";
import EmailEvent from "../models/EmailEvent.js";
import { isAuthenticated } from "../middleware/auth.js";

const r = Router();
r.get("/", isAuthenticated, async (req, res) => {
    const { estimateId, to } = req.query || {};
    const q = {};
    if (estimateId) q.estimateId = estimateId;
    if (to) q.to = to;
    const events = await EmailEvent.find(q).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, events });
});
export default r;
