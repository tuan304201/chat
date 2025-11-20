import path from "path";
import fs from "fs";

export const publicUrlFor = (filePath) => {
  // filePath: absolute or relative path under uploads/
  // For dev, we expose /uploads static in app.js, so return path relative to server root
  const rel = path.relative(process.cwd(), filePath).replace(/\\/g, "/"); // handle windows path
  return `/${rel}`;
};

export const removeFile = async (filePath) => {
  try {
    if (!filePath) return;
    if (!path.isAbsolute(filePath)) filePath = path.join(process.cwd(), filePath);
    await fs.promises.unlink(filePath).catch(() => {});
  } catch (err) {
    // swallow error (log if needed)
    console.warn("removeFile error", err.message);
  }
};
