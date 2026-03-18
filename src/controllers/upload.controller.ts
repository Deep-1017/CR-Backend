import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import cloudinary from '../config/cloudinary';

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }

    // req.file.buffer contains the file in memory
    const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: 'cr-music',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        ).end(req.file!.buffer);
    });

    res.status(200).json({
        url: result.secure_url,
        publicId: result.public_id,
    });
});