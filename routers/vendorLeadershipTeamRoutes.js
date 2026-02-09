// routers/vendorLeadershipTeamRoutes.js
import express from "express";
import { isVendorAuthenticated } from "../middleware/vendorUserAuth.js";
import {
    leaderGetTeamCandidates,
    leaderInviteTeamMember,
    memberGetMyInvites,
    memberRespondInvite,
} from "../controllers/VendorLeadershipTeamController.js";

const router = express.Router();

// Leader routes
router.get("/team-candidates", isVendorAuthenticated, leaderGetTeamCandidates);
router.post("/invite-member", isVendorAuthenticated, leaderInviteTeamMember);

// Member routes
router.get("/my-invites", isVendorAuthenticated, memberGetMyInvites);
router.post("/respond-invite", isVendorAuthenticated, memberRespondInvite);

export default router;
