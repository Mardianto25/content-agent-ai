import { spawn as spawnProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { generateNarrationAudio } from "./tts.js";
import { getBacksoundPath } from "./backsound-pixabay.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = resolve(root, "generated");
const width = 1080;
const height = 1920;

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
    `<text x="88" y="${yStart + lineIndex * 72}" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="700">${escapeXml(line)}</text>`
  ).join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#071d18" stop-opacity=".35"/><stop offset=".48" stop-color="#071d18" stop-opacity="0"/><stop offset="1" stop-color="#071d18" stop-opacity=".82"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/><text x="88" y="132" fill="#d9ff72" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="3">CONTENT AGENT  /  ${String(index + 1).padStart(2, "0")}</text>${labels}</svg>`;
}

function runFfmpeg(args) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawnProcess(ffmpegPath, args, { stdio: "inherit" });
    proc.once("error", reject);
    proc.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`FFmpeg gagal merender (kode ${code}).`));
    });
  });
}

export async function renderVideo({ id, scenes, images, musicKeyword, audioMode, customAudioFile, totalDuration = 15 }) {
  const projectDir = join(outputRoot, id);
  await mkdir(projectDir, { recursive: true });
  
  const fps = 30;
  const sceneCount = scenes.length || 3;
  const durationPerScene = totalDuration / sceneCount;
  const framesPerScene = Math.round(durationPerScene * fps);

  const segmentPaths = [];
  const imageUrls = [];
  const audioPaths = [];

  for (let index = 0; index < scenes.length; index += 1) {
    const imagePath = join(projectDir, `scene-${index + 1}.jpg`);
    const overlayPath = join(projectDir, `overlay-${index + 1}.png`);
    const segmentPath = join(projectDir, `segment-${index + 1}.mp4`);
    const audioPath = join(projectDir, `narration-${index + 1}.mp3`);

    // 1. Render Gambar & Overlay
    await sharp(images[index].data)
      .resize(width, height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 88 })
      .toFile(imagePath);
    await sharp(Buffer.from(overlaySvg(scenes[index].overlay, index)))
      .png()
      .toFile(overlayPath);

    // 2. Buat Audio TTS HANYA jika mode 'tts_and_music'
    if (audioMode === "tts_and_music") {
      try {
        await generateNarrationAudio(scenes[index].narration, audioPath);
        audioPaths.push(audioPath);
      } catch (err) {
        console.warn(`⚠️ TTS adegan ${index + 1} gagal, membuat file audio senyap (silent).`);
        // Buat file dummy kosong agar tidak merusak hitungan concat
        await runFfmpeg([
          "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(durationPerScene), audioPath
        ]);
        audioPaths.push(audioPath);
      }
    }

    // 3. Render Klip Video Adegan (Tanpa Audio Internal)
    await runFfmpeg([
      "-y", "-loop", "1", "-framerate", String(fps), "-i", imagePath,
      "-loop", "1", "-framerate", String(fps), "-i", overlayPath,
      "-filter_complex",
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0005,1.075)':d=${framesPerScene}:s=1080x1920:fps=${fps},setsar=1[bg];[1:v]format=rgba[fg];[bg][fg]overlay=0:0:shortest=1,format=yuv420p[v]`,
      "-map", "[v]", "-frames:v", String(framesPerScene), "-an",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
      "-movflags", "+faststart", segmentPath,
    ]);

    segmentPaths.push(segmentPath);
    imageUrls.push(`/generated/${id}/scene-${index + 1}.jpg`);
  }

  const videoPath = join(projectDir, "video.mp4");
  const videoInputs = segmentPaths.flatMap((p) => ["-i", p]);
  const concatVideo = segmentPaths.map((_, i) => `[${i}:v]`).join("");

  // Ambil Backsound (Kustom atau Fallback)
  const backsoundPath = await getBacksoundPath(projectDir, musicKeyword || "lofi", customAudioFile);

  // === PERCABANGAN AMAN BERDASARKAN MODE AUDIO ===
  if (audioMode === "mute") {
    // KONDISI A: Mode Bisu (Tanpa Audio)
    await runFfmpeg([
      "-y", ...videoInputs,
      "-filter_complex", `${concatVideo}concat=n=${segmentPaths.length}:v=1:a=0[v_out]`,
      "-map", "[v_out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
      "-movflags", "+faststart", videoPath,
    ]);
  } else if (audioMode === "music_only" || audioPaths.length === 0) {
    // KONDISI B: Mode Hanya Backsound (Atau fallback jika TTS kosong)
    await runFfmpeg([
      "-y", ...videoInputs, "-i", backsoundPath,
      "-filter_complex", `${concatVideo}concat=n=${segmentPaths.length}:v=1:a=0[v_out];[${segmentPaths.length}:a]volume=0.8[a_out]`,
      "-map", "[v_out]", "-map", "[a_out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", videoPath,
    ]);
  } else {
    // KONDISI C: Mode Narasi (TTS) + Backsound (Dijamin audioPaths.length > 0)
    const audioInputs = audioPaths.flatMap((p) => ["-i", p]);
    const concatAudio = audioPaths.map((_, i) => `[${segmentPaths.length + i}:a]`).join("");
    const backsoundIndex = segmentPaths.length + audioPaths.length;

    let filterComplex = `${concatVideo}concat=n=${segmentPaths.length}:v=1:a=0[v_out];`;
    filterComplex += `${concatAudio}concat=n=${audioPaths.length}:v=0:a=1[a_narration];`;
    filterComplex += `[${backsoundIndex}:a]volume=0.15[a_bg];`;
    filterComplex += `[a_narration][a_bg]amix=inputs=2:duration=first:dropout_transition=2[a_out]`;

    await runFfmpeg([
      "-y", ...videoInputs, ...audioInputs, "-i", backsoundPath,
      "-filter_complex", filterComplex,
      "-map", "[v_out]", "-map", "[a_out]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", videoPath,
    ]);
  }

  return {
    videoPath,
    videoUrl: `/generated/${id}/video.mp4`,
    imageUrls,
    durationSeconds: totalDuration,
  };
}