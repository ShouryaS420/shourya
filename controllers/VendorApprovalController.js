// controllers/VendorApprovalController.js
import VendorUsers from "../models/VendorUsers.js";

/**
 * List vendor users by approval status (default: PENDING)
 * GET /api/vendor/approval/vendors?status=PENDING
 */
export const listVendorsByApprovalStatus = async (req, res) => {
    try {
        const status = (req.query.status || "PENDING").toUpperCase();

        const allowed = ["NEW", "PENDING", "APPROVED", "REJECTED"];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Use NEW, PENDING, APPROVED, REJECTED",
            });
        }

        const vendors = await VendorUsers.find({ approvalStatus: status })
            .select(
                "mobile username fullName role department approvalStatus approvalNote approvedAt approvedBy onboardingStep kyc.status createdAt"
            )
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: vendors });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

/**
 * Approve vendor user
 * PATCH /api/vendor/approval/vendors/:id/approve
 * body: { note?: string, approvedBy?: string, activate?: boolean }
 */
export const approveVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { note = "", approvedBy = "system", activate = true } = req.body || {};

        const user = await VendorUsers.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        // Optional guard: only allow approve if submitted
        // if (user.onboardingStep !== "SUBMITTED" && user.onboardingStep !== "DONE") {
        //   return res.status(400).json({
        //     success: false,
        //     message: "Cannot approve. Onboarding not submitted yet.",
        //   });
        // }

        user.approvalStatus = "APPROVED";
        user.approvalNote = note;
        user.approvedAt = new Date();
        user.approvedBy = approvedBy;

        // Recommended: approved vendors active by default
        user.isActive = !!activate;

        // If you want: lock onboarding when approved
        user.onboardingStep = "DONE";

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Vendor approved",
            data: user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

/**
 * Reject vendor user
 * PATCH /api/vendor/approval/vendors/:id/reject
 * body: { reason?: string, rejectedBy?: string, deactivate?: boolean }
 */
export const rejectVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason = "", rejectedBy = "system", deactivate = true } = req.body || {};

        const user = await VendorUsers.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        user.approvalStatus = "REJECTED";
        user.approvalNote = reason;
        user.approvedAt = undefined;
        user.approvedBy = rejectedBy;

        // Recommended: rejected vendors inactive
        if (deactivate) user.isActive = false;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Vendor rejected",
            data: user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

/**
 * Move vendor to PENDING (useful when onboarding is submitted)
 * PATCH /api/vendor/approval/vendors/:id/mark-pending
 */
export const markVendorPending = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await VendorUsers.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Vendor not found" });

        user.approvalStatus = "PENDING";
        await user.save();

        return res.status(200).json({ success: true, message: "Vendor marked as PENDING", data: user });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
