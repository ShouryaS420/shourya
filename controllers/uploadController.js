import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure the uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Set storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Init upload
const upload = multer({
    storage: storage,
    // limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    }
}).fields([
    { name: 'singleImage', maxCount: 1 },
    { name: 'multipleImage', maxCount: 10 },
]);

// Function to check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only! Please upload JPEG, JPG, PNG, or GIF file formats.');
    }
}

// Handle image upload
// controllers/uploadController.js
export const uploadImage = async (req, res) => {
    try {
        const files = req.files || {};
        const single = files.singleImage?.[0];
        const multi = files.multipleImage || [];

        if (!single && multi.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded. Use singleImage or multipleImage.",
            });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        const data = {};

        if (single) {
            const rel = `uploads/${single.filename}`;     // DB friendly
            const relSlash = `/${rel}`;                   // browser path
            data.singleImage = rel;
            data.singleImageUrl = relSlash;
            data.absoluteUrl = `${baseUrl}${relSlash}`;   // full preview
        }

        if (multi.length) {
            data.multipleImages = multi.map((f) => `uploads/${f.filename}`);
            data.multipleImagesUrl = multi.map((f) => `/uploads/${f.filename}`);
            data.multipleAbsoluteUrls = multi.map((f) => `${baseUrl}/uploads/${f.filename}`);
        }

        return res.json({
            success: true,
            message: "Files uploaded",
            data,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Upload failed",
            error: err.message,
        });
    }
};
