import express from "express";
import {
    listBanners,
    getBanner,
    createBanner,
    updateBanner,
    deleteBanner,
    listBannerCodes,
} from "../controllers/adminBannerController.js";

const router = express.Router();

// Admin-only
// router.use(requireAdminAuth, requireRole("admin", "founder"));

router.get("/admin/banners", listBanners);
router.get("/admin/banners/codes", listBannerCodes);
router.get("/admin/banners/:id", getBanner);
router.post("/admin/banners", createBanner);
router.put("/admin/banners/:id", updateBanner);
router.delete("/admin/banners/:id", deleteBanner);

export default router;
