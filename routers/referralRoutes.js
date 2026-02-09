// routers/referralRoutes.js
import express from "express";
import crypto from "crypto";
import Referral from "../models/Referral.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { isAuthenticated, requireAuth, requireCRM } from "../middleware/auth.js";
import {
    isEligibleForOneShot,
    computePayout,
    pushEvent,
} from "../utils/referralPayout.js";

const r = express.Router();

// Normalize + hash helpers
// Canonicalize to last 10 digits for Indian numbers. Handles 0/91 prefixes.
const canonINPhone10 = (s = "") => {
    const d = String(s).replace(/\D/g, "");
    if (d.length >= 10) return d.slice(-10);
    return d; // if somehow shorter, return as-is (will fail validation somewhere else)
};
const normEmail = (s = "") => s.trim().toLowerCase();
const sha = (s = "") => crypto.createHash("sha256").update(s).digest("hex");
const esc = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // for regex

// Create referral via link/QR
r.post("/", isAuthenticated, async (req, res) => {
    try {
        const { name, phone, email, city, plotAddress, package: pkg } = req.body;

        const phone10 = phone ? canonINPhone10(phone) : null;
        const phoneHash = phone10 ? sha(phone10) : null;
        const emailNorm = email ? normEmail(email) : null;
        const emailHash = emailNorm ? sha(emailNorm) : null;

        // A) HARD BLOCK if this phone/email already exists on any User (system-level)
        //    We match phone by "endsWith 10 digits" to handle stored values like +91..., 0..., spaces.
        if (phone10) {
            const phoneEndsRegex = new RegExp(`${esc(phone10)}$`); // ends with the 10 digits
            const userByPhone = await User.findOne({ mobile: { $regex: phoneEndsRegex } }).lean();
            if (userByPhone) {
                return res.status(409).json({ success: false, message: "Lead already exists in our system." });
            }
        }
        if (emailNorm) {
            const userByEmail = await User.findOne({ email: new RegExp(`^${esc(emailNorm)}$`, "i") }).lean();
            if (userByEmail) {
                return res.status(409).json({ success: false, message: "Lead already exists in our system." });
            }
        }

        // dedupe in last 18 months
        const recent = new Date(Date.now() - 18 * 30 * 24 * 3600 * 1000);
        const or = [];
        if (phoneHash) or.push({ "referee.phoneHash": phoneHash });
        if (emailHash) or.push({ "referee.emailHash": emailHash });
        if (or.length) {
            const exists = await Referral.findOne({ $and: [{ createdAt: { $gte: recent } }, { $or: or }] });
            if (exists) {
                return res.status(409).json({ success: false, message: "Lead already exists recently." });
            }
        }

        const ref = await Referral.create({
            code: `REF-${Math.floor(Math.random() * 100000)}`,
            referrerUserId: req.user._id,
            referee: { name, phoneHash, emailHash, phoneTail: phone10?.slice(-4) || null, city, plotAddress },
            attribution: { firstTouchAt: new Date(), lastTouchAt: new Date() },
            project: { package: pkg ?? null },
            status: "VALID",
        });
        pushEvent(ref, "REFERRAL_SUBMITTED", req.user._id.toString());
        await ref.save();

        res.json({ success: true, referral: ref });
    } catch (err) {
        console.error("POST /api/referrals error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// My referrals
r.get("/mine", isAuthenticated, async (req, res) => {
    try {
        const items = await Referral.find({ referrerUserId: req.user._id }).sort({
            createdAt: -1,
        });
        res.json({ success: true, items });
    } catch (err) {
        console.error("GET /api/referrals/mine error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Check existence by phone/email before creating
r.get("/check", isAuthenticated, async (req, res) => {
    try {
        const { phone, email } = req.query;
        const recent = new Date(Date.now() - 18 * 30 * 24 * 3600 * 1000);

        const checks = { userHit: false, referralHit: false };

        // ---- check Users table first (system-wide) ----
        if (phone) {
            const p10 = canonINPhone10(phone);
            if (p10) {
                const phoneEndsRegex = new RegExp(`${esc(p10)}$`);
                const userByPhone = await User.findOne({ mobile: { $regex: phoneEndsRegex } }).lean();
                if (userByPhone) checks.userHit = true;
            }
        }
        if (email) {
            const eNorm = normEmail(email);
            if (eNorm) {
                const userByEmail = await User.findOne({ email: new RegExp(`^${esc(eNorm)}$`, "i") }).lean();
                if (userByEmail) checks.userHit = true;
            }
        }

        // ---- if not in Users, check Referrals (18 months) ----
        if (!checks.userHit) {
            const or = [];
            if (phone) {
                const p10 = canonINPhone10(phone);
                const pHash = p10 ? sha(p10) : null;
                if (pHash) or.push({ "referee.phoneHash": pHash });
            }
            if (email) {
                const eNorm = normEmail(email);
                const eHash = eNorm ? sha(eNorm) : null;
                if (eHash) or.push({ "referee.emailHash": eHash });
            }
            if (or.length) {
                const exists = await Referral.findOne({ $and: [{ createdAt: { $gte: recent } }, { $or: or }] });
                if (exists) checks.referralHit = true;
            }
        }

        res.json({
            success: true,
            exists: checks.userHit || checks.referralHit,
            userHit: checks.userHit,
            referralHit: checks.referralHit,
        });
    } catch (e) {
        console.error("GET /api/referrals/check", e);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// CRM updates: contract value / start / add receipts
r.post("/:id/crm-update", async (req, res) => {
    try {
        const { contractValue, startedAt, receiptsAdd } = req.body;
        const ref = await Referral.findById(req.params.id);
        if (!ref) return res.status(404).json({ success: false, message: "Not found" });

        if (contractValue != null) {
            ref.project.contractValue = Number(contractValue);
            pushEvent(ref, "CONTRACT_UPDATE", "crm", `contractValue=${contractValue}`);
        }
        if (startedAt) {
            ref.project.startedAt = new Date(startedAt);
            ref.status = "UNDER_CONSTRUCTION";
            pushEvent(ref, "START_SET", "crm", `startedAt=${startedAt}`);
        }
        if (receiptsAdd != null) {
            ref.project.receiptsCollected += Number(receiptsAdd);
            pushEvent(ref, "RECEIPT_ADD", "crm", `+${receiptsAdd}`);
        }

        // 20% eligibility check
        if (
            isEligibleForOneShot({
                startedAt: ref.project.startedAt,
                receipts: ref.project.receiptsCollected,
                contract: ref.project.contractValue,
            }) &&
            !["ELIGIBLE_20", "PAYOUT_PROCESSING", "PAID"].includes(ref.status)
        ) {
            ref.status = "ELIGIBLE_20";
            ref.eligibleAt = new Date();
            ref.payout.amount = computePayout({
                contract: ref.project.contractValue,
                rate: ref.policySnapshot.referralRate,
                cap: ref.policySnapshot.capINR,
            });
            pushEvent(ref, "ELIGIBLE_20", "system");
        }

        await ref.save();
        res.json({ success: true, referral: ref });
    } catch (err) {
        console.error("POST /api/referrals/:id/crm-update error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Finance release (one-shot payout)
r.post("/:id/release", async (req, res) => {
    try {
        const { txId: txIdFromClient } = req.body || {};
        const ref = await Referral.findById(req.params.id);
        if (!ref) return res.status(404).json({ success: false, message: "Not found" });
        if (ref.status !== "ELIGIBLE_20")
            return res.status(400).json({ success: false, message: "Not eligible" });

        const tdsRate = Number(process.env.REFERRAL_TDS_RATE ?? 0.05); // 5% default
        const tds = Math.round(ref.payout.amount * tdsRate);
        const net = ref.payout.amount - tds;

        const wallet = await Wallet.findOneAndUpdate(
            { userId: ref.referrerUserId },
            { $setOnInsert: { userId: ref.referrerUserId, balance: 0 } },
            { upsert: true, new: true }
        );

        wallet.balance += net;
        const txId = txIdFromClient || `R${ref._id.toString().slice(-6)}${Date.now()}`;
        wallet.ledger.push({
            referralId: ref._id,
            type: "CREDIT",
            milestone: "REFERRAL_PAYOUT",
            amount: ref.payout.amount,
            tds,
            net,
            txId,
        });
        await wallet.save();

        ref.status = "PAID";
        ref.payout.tds = tds;
        ref.payout.netAmount = net;
        ref.payout.paidAt = new Date();
        ref.payout.txId = txId;
        pushEvent(ref, "PAID", "finance", `txId=${txId}`);
        await ref.save();

        res.json({ success: true, referral: ref, wallet });
    } catch (err) {
        console.error("POST /api/referrals/:id/release error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

const POLICY_DEFAULTS = { rate: 0.01, cap: 400000 };

r.get('/referrals/metrics', async (req, res) => {
    const [
        total,
        paid,
        expired
    ] = await Promise.all([
        Referral.countDocuments({}),
        Referral.countDocuments({ status: { $in: ['PAID', 'CLOSED_PAID'] } }),
        Referral.countDocuments({ status: { $in: ['EXPIRED', 'NOT_ELIGIBLE', 'REJECTED', 'DUPLICATE', 'CANCELLED'] } }),
    ]);

    // Eligible (started && receipts >= 20% contract)
    const eligible = await Referral.countDocuments({
        "project.startedAt": { $ne: null },
        $expr: { $gte: ['$project.receiptsCollected', { $multiply: [0.2, '$project.contractValue'] }] }
    });

    // Pending = everything else
    const pending = Math.max(0, total - paid - expired);

    res.json({
        total, pending, eligible, paid, expired,
        policy: POLICY_DEFAULTS
    });
});

// Admin list with filters, join referrer user, and flatten project fields for UI
r.get("/", async (req, res) => {
    try {
        const {
            q = "",            // name/phone tail search
            status = "",       // exact status
            from = "",         // ISO date (createdAt >= from)
            to = "",           // ISO date (createdAt <= to)
            eligible,          // "1" => only eligible
            page = 1,
            limit = 20,
        } = req.query;

        const where = {};

        if (status) where.status = status;
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.$gte = new Date(from);
            if (to) where.createdAt.$lte = new Date(to);
        }
        if (q) {
            // search on referee name (case-insensitive) or phoneTail
            where.$or = [
                { "referee.name": { $regex: q, $options: "i" } },
                { "referee.phoneTail": { $regex: q.replace(/\D/g, ""), $options: "i" } },
                { code: { $regex: q, $options: "i" } },
            ];
        }

        // apply eligible (receipts >= 20% * contract & startedAt set)
        if (eligible === "1") {
            where["project.startedAt"] = { $ne: null };
            where.$expr = {
                $gte: ["$project.receiptsCollected", { $multiply: [0.2, "$project.contractValue"] }],
            };
        }

        const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
        const lim = Math.max(1, Math.min(200, Number(limit)));

        const [items, total] = await Promise.all([
            Referral.find(where)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(lim)
                .populate("referrerUserId", "username email mobile") // who referred
                .lean(),
            Referral.countDocuments(where),
        ]);

        // Flatten to what your UI expects
        const out = items.map((r) => ({
            _id: r._id,
            code: r.code,
            // referee display: name + phoneTail
            referee: {
                name: r.referee?.name || "",
                phone: r.referee?.phoneTail ? `***${r.referee.phoneTail}` : "—",
                city: r.referee?.city || "",
            },
            // NOTE: UI expects top-level numbers; map from project.*
            status: r.status,
            contractValue: r.project?.contractValue ?? 0,
            receiptsCollected: r.project?.receiptsCollected ?? 0,
            startedAt: r.project?.startedAt || null,
            package: r.project?.package || null,
            policySnapshot: r.policySnapshot || { rate: 0.01, cap: 400000 },
            payout: r.payout || { amount: 0, netAmount: 0, tds: 0, txId: null, paidAt: null },
            events: r.events || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            // referrer (from User model)
            referrer: {
                _id: r.referrerUserId?._id,
                name: r.referrerUserId?.username || "",
                email: r.referrerUserId?.email || "",
                mobile: r.referrerUserId?.mobile || "",
            },
        }));

        res.json({ items: out, total, page: Number(page), limit: lim });
    } catch (err) {
        console.error("GET /api/referrals error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

r.get("/:id", async (req, res) => {
    try {
        const r = await Referral.findById(req.params.id)
            .populate("referrerUserId", "username email mobile")
            .lean();
        if (!r) return res.status(404).json({ success: false, message: "Not found" });

        const out = {
            _id: r._id,
            code: r.code,
            referee: {
                name: r.referee?.name || "",
                phone: r.referee?.phoneTail ? `***${r.referee.phoneTail}` : "—",
                city: r.referee?.city || "",
                plotAddress: r.referee?.plotAddress || "",
            },
            status: r.status,
            contractValue: r.project?.contractValue ?? 0,
            receiptsCollected: r.project?.receiptsCollected ?? 0,
            startedAt: r.project?.startedAt || null,
            package: r.project?.package || null,
            policySnapshot: r.policySnapshot || { rate: 0.01, cap: 400000 },
            payout: r.payout || { amount: 0, netAmount: 0, tds: 0, txId: null, paidAt: null },
            events: r.events || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            referrer: {
                _id: r.referrerUserId?._id,
                name: r.referrerUserId?.username || "",
                email: r.referrerUserId?.email || "",
                mobile: r.referrerUserId?.mobile || "",
            },
        };
        res.json(out);
    } catch (err) {
        console.error("GET /api/referrals/:id error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

r.patch("/:id", async (req, res) => {
    try {
        const { contractValue, receiptsCollected, status, startedAt, package: pkg } = req.body || {};
        const ref = await Referral.findById(req.params.id);
        if (!ref) return res.status(404).json({ success: false, message: "Not found" });

        let touched = false;

        if (contractValue != null) {
            ref.project.contractValue = Number(contractValue);
            touched = true;
            pushEvent(ref, "CONTRACT_UPDATE", "crm", `contractValue=${contractValue}`);
        }
        if (receiptsCollected != null) {
            ref.project.receiptsCollected = Number(receiptsCollected);
            touched = true;
            pushEvent(ref, "RECEIPT_SET", "crm", `to=${receiptsCollected}`);
        }
        if (startedAt) {
            ref.project.startedAt = new Date(startedAt);
            if (ref.status === "VALID") ref.status = "UNDER_CONSTRUCTION";
            touched = true;
            pushEvent(ref, "START_SET", "crm", `startedAt=${startedAt}`);
        }
        if (pkg) {
            ref.project.package = pkg;
            touched = true;
            pushEvent(ref, "PACKAGE_SET", "crm", `package=${pkg}`);
        }
        if (status) {
            ref.status = status;
            touched = true;
            pushEvent(ref, "STATUS_SET", "crm", `status=${status}`);
        }

        // Recompute eligibility + payout when data changes
        if (touched) {
            const started = !!ref.project.startedAt;
            const eligible = started && ref.project.receiptsCollected >= 0.2 * ref.project.contractValue;
            if (eligible && !["ELIGIBLE_20", "PAYOUT_PROCESSING", "PAID"].includes(ref.status)) {
                ref.status = "ELIGIBLE_20";
                ref.eligibleAt = new Date();
                ref.payout.amount = computePayout({
                    contract: ref.project.contractValue,
                    rate: ref.policySnapshot.referralRate,
                    cap: ref.policySnapshot.capINR,
                });
                pushEvent(ref, "ELIGIBLE_20", "system");
            }
        }

        await ref.save();
        // Return with flattening like GET /:id
        req.params.id = ref._id.toString();
        return r.handle({ ...req, method: "GET", url: `/${ref._id}` }, res);
    } catch (err) {
        console.error("PATCH /api/referrals/:id error", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default r;
