// routers/systemLeadershipSelectionRoutes.js
import express from "express";
import { selectLeaderForProgram } from "../controllers/SystemLeadershipSelectionController.js";

const router = express.Router();

// This can be protected by admin auth or internal secret
router.post("/select-leader", selectLeaderForProgram);

export default router;
