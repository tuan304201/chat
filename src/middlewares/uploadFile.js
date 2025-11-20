import multer from "multer";
import path from "path";
import fs from "fs";
import sanitize from "sanitize-filename";

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Generic disk storage factory
export const createStorage = (subfolder = "files") => {
  const uploadPath = path.join(process.cwd(), "uploads", subfolder);
  ensureDir(uploadPath);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // sanitize original name then prefix timestamp + random
      const ext = path.extname(file.originalname) || "";
      const name = sanitize(path.basename(file.originalname, ext)).replace(/\s+/g, "_").toLowerCase();
      const filename = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${name}${ext}`;
      cb(null, filename);
    },
  });
};

export const createUploadMiddleware = ({ subfolder = "files", allowedMime = [], maxSize = 5 * 1024 * 1024 }) => {
  const storage = createStorage(subfolder);
  const fileFilter = (req, file, cb) => {
    if (allowedMime.length && !allowedMime.includes(file.mimetype)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Invalid mime type"));
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSize },
  });
};
