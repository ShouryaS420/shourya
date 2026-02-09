import mongoose from 'mongoose';
import VendorUsers from '../models/VendorUsers.js';
import { sendVendorUserToken } from '../utils/sendVendorUserToken.js';

// Controller to create a new project
export const createVendorUser = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const { username, email, mobile, role, department, } = req.body;

        // Validation: Check if any of the required fields are empty
        if (!username || !email || !mobile || !role || !department) {
            return res.status(400).json({ message: 'All fields must be filled.', success: false });
        }

        const newUser = new VendorUsers(req.body);

        const saveUserDetails = await newUser.save({ session });

        await session.commitTransaction();
        res.status(201).json({ message: "User Created Successfully", success: true, data: saveUserDetails });

    } catch (error) {

        console.error('Transaction error:', error); // Enhanced logging
        await session.abortTransaction();
        res.status(500).json({ message: 'Server error', error: error.message, success: false });

    } finally {
        session.endSession();
    }
};

export const getVendorUser = async (req, res) => {
    try {
        const vendors = await VendorUsers.find();
        res.status(200).json(vendors);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ success: false, message: "Please fill all required fields." });
        }

        const isMobile = /^\d{10}$/.test(input);
        if (!isMobile) {
            return res.status(400).json({ success: false, message: "Invalid mobile number" });
        }

        let user = await VendorUsers.findOne({ mobile: input });

        // ✅ If user does not exist → create “NEW” user shell
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await VendorUsers.create({
                mobile: input,
                username: input,          // safe default
                approvalStatus: "NEW",
                onboardingStep: "NEW",
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000);
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        await user.save();

        // TODO: send OTP via WhatsApp/SMS in production
        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            otp, // remove in production
            isNewUser,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const { input, otp } = req.body;

        const isEmail = /\S+@\S+\.\S+/.test(input);
        const isMobile = /^\d{10}$/.test(input);

        let user = null;
        if (isEmail) user = await VendorUsers.findOne({ email: input });
        else if (isMobile) user = await VendorUsers.findOne({ mobile: input });
        else return res.status(400).json({ success: false, message: "Invalid email or mobile number" });

        if (!user) return res.status(400).json({ success: false, message: "User not found" });

        if (!user.otp || !user.otpExpiresAt) {
            return res.status(400).json({ success: false, message: "OTP not found or expired" });
        }

        if (String(user.otp) !== String(otp)) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (user.otpExpiresAt < new Date()) {
            return res.status(400).json({ success: false, message: "OTP expired" });
        }

        // clear OTP
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        // IMPORTANT: correct argument order and return
        return sendVendorUserToken(user, res, 200);

    } catch (error) {
        return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
};

export const getMyProfile = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;
        if (!vendorId) return res.status(401).json({ success: false, message: "Vendor auth required" });

        const user = await VendorUsers.findById(vendorId);

        return sendVendorUserToken(user, res, 200);

    } catch (error) {
        res.status(500).send({ success: false, message: `server error: ${error.message}` });
    }
}

export const logout = async (req, res) => {
    try {
        res
            .status(200)
            .cookie("token", null, {
                expires: new Date(Date.now()),
            })
            .json({ success: true, message: "Logged out successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUsersById = async (req, res) => {
    try {
        // console.log("Headers (Backend):", req.headers);  // ✅ Log headers
        // console.log("Request Body (Backend):", req.body);  // ✅ Log body to see if data is received

        const { teamMemberIds } = req.body;

        if (!teamMemberIds || !Array.isArray(teamMemberIds) || teamMemberIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing team member IDs",
            });
        }

        const assignedTeam = await VendorUsers.find({
            _id: { $in: teamMemberIds },
        }).select("username email mobile role department");

        if (!assignedTeam || assignedTeam.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No team members found for the provided IDs",
            });
        }

        return res.status(200).json({
            success: true,
            data: assignedTeam,
        });

    } catch (error) {
        console.error("Error fetching assigned team members:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch assigned team members",
            error: error.message,
        });
    }
};