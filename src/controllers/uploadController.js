import path from "path";
import { publicUrlFor } from "../utils/file.js";
import { probeAudio, convertAudio } from "../utils/audio.js";

export const uploadFile = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });
    // Return public URL & metadata
    const absPath = file.path;
    const url = publicUrlFor(absPath);
    return res.json({
      success: true,
      file: {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const uploadAudio = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No audio uploaded" });

    const absPath = file.path;
    // probe duration
    let duration = null;
    try {
      const info = await probeAudio(absPath);
      duration = info.duration; // ms
    } catch (err) {
      console.warn("probe audio failed", err.message);
    }

    const url = publicUrlFor(absPath);
    return res.json({
      success: true,
      file: {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url,
        duration,
      },
    });
  } catch (err) {
    next(err);
  }
};
