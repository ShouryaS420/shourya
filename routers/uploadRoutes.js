import express from "express";
// import { upload } from "../middlewares/uploadMulter.js";
import { uploadImage } from "../controllers/uploadController.js";
import { upload } from "../middleware/uploadMulter.js";

const router = express.Router();

// supports both singleImage + multipleImage (same as your UI)
router.post(
    "/upload",
    upload.fields([
        { name: "singleImage", maxCount: 1 },
        { name: "multipleImage", maxCount: 10 },
    ]),
    uploadImage
);

export default router;
