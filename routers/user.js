// Importing express and controllers
import express from 'express';
import {
    addAlternatePhone,
    checkIdentifier,
    getMyProfile,
    getUserById,
    googleLogin,
    login,
    logout,
    registerBegin,
    startWorking,
    updateMe,
    verifyOtp,
} from '../controllers/User.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);

router.post('/check', checkIdentifier);

router.post('/register-begin', registerBegin);

router.post('/verifyOtp', verifyOtp);

router.route("/logout").get(logout);

router.route("/me").get(isAuthenticated, getMyProfile);

router.route("/addAlternatePhone").put(addAlternatePhone);

router.route("/getUserById/:id").get(getUserById);

router.route("/startWorking/:userId/:constructionId").put(startWorking);

router.post('/google', googleLogin);

router.route("/me").put(isAuthenticated, updateMe);

export default router;
