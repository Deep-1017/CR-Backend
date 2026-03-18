import express from 'express';
import multer from 'multer';
import { uploadImage } from '../controllers/upload.controller';
import { protect, admin } from '../middleware/auth.middleware';

const router = express.Router();

// Store file in memory (buffer) — Cloudinary handles the actual storage
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG and WEBP images are allowed'));
        }
    },
});

// POST /api/v1/upload  — admin only
router.post('/', protect, admin, upload.single('image'), uploadImage);

export default router;