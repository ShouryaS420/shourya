// controllers/VendorProfileController.js
import VendorUsers from "../models/VendorUsers.js";
import { computeWorkerBadge } from "../utils/workerBadge.js";

function normalizeIFSC(v) {
    return String(v || "").trim().toUpperCase();
}

function isValidIFSC(ifsc) {
    // Basic IFSC format: 4 letters + 0 + 6 alphanumeric
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
}

export const getMyProfileDetails = async (req, res) => {
    try {
        const user = await VendorUsers.findById(req.user._id).select("-otp -otpExpiresAt");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const badge = computeWorkerBadge({
            skillCategory: user.skillCategory,
            skillLevel: user.skillLevel,
        });

        return res.json({
            success: true,
            user,
            badge,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error", error: e.message });
    }
};

// controllers/VendorProfileController.js
export const upsertMyBankDetails = async (req, res) => {
    try {
        const user = await VendorUsers.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const currentStatus = user.bank?.status || "NOT_ADDED";

        // ✅ Lock rule:
        // - Allow only if NOT_ADDED or FAILED
        // - Block if PENDING or VERIFIED (cannot edit again)
        if (currentStatus === "PENDING" || currentStatus === "VERIFIED") {
            return res.status(403).json({
                success: false,
                message:
                    currentStatus === "PENDING"
                        ? "Bank details are under verification. You cannot edit now."
                        : "Bank details are verified. Contact support to change.",
            });
        }

        const {
            accountHolderName,
            accountNumber,
            ifsc,
            bankName,
            branchName,
            upiId,
            cancelledChequeUrl,
        } = req.body;

        const cleanName = String(accountHolderName || "").trim();
        const cleanAcc = String(accountNumber || "").trim();
        const cleanIfsc = normalizeIFSC(ifsc);
        const cleanBank = String(bankName || "").trim();
        const cleanBranch = String(branchName || "").trim();
        const cleanUpi = String(upiId || "").trim();
        const cleanCheque = String(cancelledChequeUrl || "").trim();

        if (!cleanName || !cleanAcc || !cleanIfsc) {
            return res.status(400).json({
                success: false,
                message: "Account holder name, account number and IFSC are required",
            });
        }

        if (!/^\d{6,18}$/.test(cleanAcc)) {
            return res.status(400).json({ success: false, message: "Invalid account number" });
        }

        if (!isValidIFSC(cleanIfsc)) {
            return res.status(400).json({ success: false, message: "Invalid IFSC code" });
        }

        user.bank = user.bank || {};

        user.bank.accountHolderName = cleanName;
        user.bank.accountNumber = cleanAcc;
        user.bank.ifsc = cleanIfsc;
        user.bank.bankName = cleanBank;
        user.bank.branchName = cleanBranch;
        user.bank.upiId = cleanUpi;
        user.bank.cancelledChequeUrl = cleanCheque;

        // ✅ After first submit it becomes PENDING and locks further edits
        user.bank.status = "PENDING";
        user.bank.submittedAt = new Date();
        user.bank.failureReason = "";
        user.bank.verifiedAt = null;

        await user.save();

        return res.json({
            success: true,
            message: "Bank details submitted",
            bank: user.bank,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error", error: e.message });
    }
};

