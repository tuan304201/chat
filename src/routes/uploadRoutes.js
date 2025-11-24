import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { createUploadMiddleware } from "../middlewares/uploadFile.js";
import * as uploadController from "../controllers/uploadController.js";

const router = Router();

// --- 1. CẤU HÌNH UPLOAD ---
// Image (Avatar/Photo) - Max 5MB
const imageUpload = createUploadMiddleware({
  subfolder: "images",
  allowedMime: ["image/jpeg", "image/png", "image/webp"],
  maxSize: 5 * 1024 * 1024,
});

// File & Audio
const fileUpload = createUploadMiddleware({
  subfolder: "files",
  allowedMime: [],
  maxSize: 20 * 1024 * 1024,
});

const audioUpload = createUploadMiddleware({
  subfolder: "audio",
  allowedMime: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/wav"],
  maxSize: 5 * 1024 * 1024,
});

// --- 2. ROUTE PUBLIC (Không cần Token) ---
// Cho phép upload ảnh lúc đăng ký
router.post("/image", imageUpload.single("file"), uploadController.uploadFile);

// --- 3. ROUTE PRIVATE (Cần Token) ---
// Các loại file khác hoặc audio chat thì bắt buộc phải đăng nhập
router.use(authMiddleware);

router.post("/file", fileUpload.single("file"), uploadController.uploadFile);
router.post("/audio", audioUpload.single("file"), uploadController.uploadAudio);

export default router;
