// routes/adminTranslateRoutes.js
import express from "express";
import { translateBannerCopy } from "../controllers/adminTranslateController.js";

const router = express.Router();

// attach your existing admin auth middleware pattern here (same as other admin APIs)
// router.use(existingAdminAuth);

router.post("/admin/translate/banner-copy", translateBannerCopy);

export default router;
