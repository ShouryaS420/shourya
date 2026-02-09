import VendorUsers from "../models/VendorUsers.js";

export const verifyVendorBank = async (req, res) => {
    try {
        const { vendorId } = req.params;

        const user = await VendorUsers.findById(vendorId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        if (user.bank.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "Bank details are not in pending state",
            });
        }

        user.bank.status = "VERIFIED";
        user.bank.verifiedAt = new Date();
        user.bank.failureReason = "";

        await user.save();

        return res.json({
            success: true,
            message: "Bank details verified successfully",
            bank: user.bank,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error", error: e.message });
    }
};

export const rejectVendorBank = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required",
            });
        }

        const user = await VendorUsers.findById(vendorId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        if (user.bank.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "Bank details are not in pending state",
            });
        }

        user.bank.status = "FAILED";
        user.bank.failureReason = reason;
        user.bank.verifiedAt = null;

        await user.save();

        return res.json({
            success: true,
            message: "Bank details rejected",
            bank: user.bank,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error", error: e.message });
    }
};
