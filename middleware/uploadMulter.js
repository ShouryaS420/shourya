// middlewares/uploadMulter.js
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) return cb(null, true);
    cb(new Error("Images only (jpeg/jpg/png/gif/webp)"));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${Date.now()}${safeExt}`);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB (adjust)
    fileFilter: (req, file, cb) => checkFileType(file, cb),
});
