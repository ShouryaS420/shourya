import VendorUsers from "../models/VendorUsers.js";

export const setVendorAttendancePolicy = async (req, res) => {
    const { vendorId } = req.params;
    const { requireAssignment } = req.body || {};

    const v = await VendorUsers.findById(vendorId);
    if (!v) return res.status(404).json({ success: false, message: "Vendor not found" });

    v.attendancePolicy = v.attendancePolicy || {};
    if (requireAssignment !== undefined) v.attendancePolicy.requireAssignment = !!requireAssignment;

    await v.save();

    return res.json({
        success: true,
        vendorId: v._id,
        attendancePolicy: v.attendancePolicy,
    });
};
