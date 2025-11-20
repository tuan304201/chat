import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { publicUrlFor } from "./file.js";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

export const probeAudio = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata?.format?.duration ? Math.round(metadata.format.duration * 1000) : null; // ms
      resolve({ duration, format: metadata.format });
    });
  });
};

export const convertAudio = (inputPath, { targetExt = "ogg", bitrate = "32k" } = {}) => {
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const outName = `${base}_conv.${targetExt}`;
  const outPath = path.join(dir, outName);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libopus") // for ogg/opus; ffmpeg-static must support
      .audioBitrate(bitrate)
      .format(targetExt)
      .on("end", async () => {
        try {
          const info = await probeAudio(outPath);
          resolve({ outputPath: outPath, duration: info.duration, url: publicUrlFor(outPath) });
        } catch (err) {
          resolve({ outputPath: outPath, duration: null, url: publicUrlFor(outPath) });
        }
      })
      .on("error", (err) => {
        reject(err);
      })
      .save(outPath);
  });
};
