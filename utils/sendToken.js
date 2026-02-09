import jwt from "jsonwebtoken";
import { deriveUiState } from "./deriveUiState.js"; // ⬅️ add

export const sendToken = (res, user, statusCode, message, extra = {}) => {

    const token = user.getJWTToken();

    const options = {
        httpOnly: true,
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 60 * 1000)
    }

    // Compute the current UI state in one place
    const uiState = deriveUiState(user);

    const userData = {
        _id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        img: user.img,
        alternateNumber: user.alternateNumber,
        projectType: user.projectType,
        plotInformation: user.plotInformation,
        currentPhase: user.currentPhase,
        progress: user.progress,
        steps: user.steps,
        isApproved: user.isApproved,
        constructionDetails: user.constructionDetails,
        startProject: user.startProject,
        twoDDesigns: user.twoDDesigns,
        threeDDesigns: user.threeDDesigns,
        paymentSchedule: user.paymentSchedule,
    }

    const payload = Object.assign({
        success: true,
        message,
        user: userData,
        setToken: token,
        uiState, // ⬅️ added line
        // expose helpful audit info for the client
        timestamps: {
            firstLoginAt: user.firstLoginAt,
            lastLoginAt: user.lastLoginAt,
            welcomeEmailSentAt: user.welcomeEmailSentAt,
        },
        ...extra,
    });

    res.status(statusCode).cookie("token", token, options).json(payload);
};