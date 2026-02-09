// routers/adminLeadershipProgramRoutes.js
import express from "express";
import {
    adminArchiveLeadershipProgram,
    adminListLeadershipPrograms,
    adminPublishLeadershipProgram,
    adminUpsertLeadershipProgram,
} from "../controllers/AdminLeadershipProgramController.js";

const router = express.Router();

router.get("/programs", adminListLeadershipPrograms);
router.post("/programs/:id", adminUpsertLeadershipProgram); // id = "new" or existing
router.post("/programs/:id/publish", adminPublishLeadershipProgram);
router.post("/programs/:id/archive", adminArchiveLeadershipProgram);

export default router;
