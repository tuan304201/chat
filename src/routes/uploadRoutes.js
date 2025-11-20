import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { createUploadMiddleware } from "../middlewares/uploadFile.js";
import * as uploadController from "../controllers/uploadController.js";

const router = Router();

// protect uploads with auth middleware
router.use(authMiddleware);

// image upload (max 5MB) - allow jpg/png/webp
const imageUpload = createUploadMiddleware({
  subfolder: "images",
  allowedMime: ["image/jpeg", "image/png", "image/webp"],
  maxSize: 5 * 1024 * 1024,
});

router.post("/image", imageUpload.single("file"), uploadController.uploadFile);

// generic file upload (max 20MB), allow common types:
const fileUpload = createUploadMiddleware({
  subfolder: "files",
  allowedMime: [], // empty means allow any
  maxSize: 20 * 1024 * 1024,
});
router.post("/file", fileUpload.single("file"), uploadController.uploadFile);

// audio upload (voice message) - allow webm/ogg/mp3 up to 2MB by default
const audioUpload = createUploadMiddleware({
  subfolder: "audio",
  allowedMime: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/wav"],
  maxSize: 5 * 1024 * 1024,
});
router.post("/audio", audioUpload.single("file"), uploadController.uploadAudio);

export default router;
