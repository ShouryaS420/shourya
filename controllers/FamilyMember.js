import mongoose from "mongoose";
import FamilyMember from "../models/FamilyMember.js";
import User from "../models/User.js";

// Controller to create a new project
export const createNewFamilyMember = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        
        const { id, name, email, mobile, relationship, } = req.body;

        // Validation: Check if any of the required fields are empty
        if (!name || !email || !mobile || !relationship) {
            return res.status(400).json({ message: 'All fields must be filled.', success: false });
        }

        const user = await User.findById(id);

        const newFamilyMember = new FamilyMember({
            mainUserID: id,
            name,
            email,
            mobile,
            relationship,
        });

        const newUserRegister = new User({
            mainUserID: id,
            userId: user.userId,
            username: name,
            email: email,
            mobile: mobile,
            img: user.img,
            alternateNumber: user.alternateNumber,
            projectType: user.projectType,
            plotInformation: user.plotInformation,
            currentPhase: user.currentPhase,
            progress: user.progress,
            steps: user.steps,
            isApproved: user.isApproved,
            familyMember: true,
        });

        await newFamilyMember.save({ session });
        await newUserRegister.save({ session });

        await session.commitTransaction();
        res.status(201).json({ message: "User Created Successfully", success: true });

    } catch (error) {
        console.error('Transaction error:', error);
        await session.abortTransaction();
        res.status(500).json({ message: 'Server error', error: error.message, success: false });
    } finally {
        session.endSession();
    }
};

export const getFamilyMemberDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const details = await FamilyMember.find({ mainUserID: id });
        res.status(200).json(details);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
    }
};

export const removeFamilyMember = async (req, res) => {
    try {

        // find the note to be delete and delete it
        let details = await FamilyMember.findById(req.params.id);
        if (!details) {
            return res.status(404).send({ message: 'Not Found', success: false });
        }

        let user = await User.find({ familyMemberID: req.params.id });

        details = await FamilyMember.findByIdAndDelete(req.params.id);
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: `${details.name} has been remove from family member.`, project: details, success: true });

    } catch (error) {
        console.error(error.message);
        res.status(500).send({ message: 'Internal Server Error', success: false });
    }
}