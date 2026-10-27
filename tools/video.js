import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const outputRoot = fileURLToPath(new URL("../generated/", import.meta.url));
const width = 1080;
const height = 1920;
const framesPerScene = 150;

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function wrapText(text, maxCharacters = 22) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function overlaySvg(text, index) {
  const lines = wrapText(text || "Cerita baru", 22);
  const yStart = 1460 - (lines.length - 1) * 58;
  const labels = lines.map((line, lineIndex) =>
    `<text x="88" y="${yStart + lineIndex * 72}" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="700">${escapeXml(line)}</text>`,
  ).join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#071d18" stop-opacity=".35"/><stop offset=".48" stop-color="#071d18" stop-opacity="0"/><stop offset="1" stop-color="#071d18" stop-opacity=".82"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/><text x="88" y="132" fill="#d9ff72" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="3">CONTENT AGENT  /  ${String(index + 1).padStart(2, "0")}</text>${labels}</svg>`;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { stdio: "ignore" });
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg gagal merender video (kode ${code}).`));
    });
  });
}

export async function renderVideo({ id, scenes, images }) {
  const projectDir = join(outputRoot, id);
  await mkdir(projectDir, { recursive: true });
  const segmentPaths = [];
  const imageUrls = [];

  for (let index = 0; index < scenes.length; index += 1) {
    const imagePath = join(projectDir, `scene-${index + 1}.jpg`);
    const overlayPath = join(projectDir, `overlay-${index + 1}.png`);
    const segmentPath = join(projectDir, `segment-${index + 1}.mp4`);

    await sharp(images[index].data)
      .resize(width, height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 88 })
      .toFile(imagePath);
    await sharp(Buffer.from(overlaySvg(scenes[index].overlay, index)))
      .png()
      .toFile(overlayPath);

    await runFfmpeg([
      "-y", "-loop", "1", "-framerate", "30", "-i", imagePath,
      "-loop", "1", "-framerate", "30", "-i", overlayPath,
      "-filter_complex",
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0005,1.075)':d=150:s=1080x1920:fps=30,setsar=1[bg];[1:v]format=rgba[fg];[bg][fg]overlay=0:0:shortest=1,format=yuv420p[v]",
      "-map", "[v]", "-frames:v", String(framesPerScene), "-an",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
      "-movflags", "+faststart", segmentPath,
    ]);

    segmentPaths.push(segmentPath);
    imageUrls.push(`/generated/${id}/scene-${index + 1}.jpg`);
  }

  const videoPath = join(projectDir, "video.mp4");
  const inputs = segmentPaths.flatMap((path) => ["-i", path]);
  const concatInputs = segmentPaths.map((_, index) => `[${index}:v]`).join("");
  await runFfmpeg([
    "-y", ...inputs,
    "-filter_complex", `${concatInputs}concat=n=${segmentPaths.length}:v=1:a=0,format=yuv420p[v]`,
    "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
    "-movflags", "+faststart", videoPath,
  ]);

  return {
    videoPath,
    videoUrl: `/generated/${id}/video.mp4`,
    imageUrls,
    durationSeconds: scenes.length * 5,
  };
}