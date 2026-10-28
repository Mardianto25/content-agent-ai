import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContentProject } from "../tools/pipeline.js";
import { uploadVideoToTikTokDraft } from "../tools/tiktok-api.js";
import multer from "multer";

const upload = multer({ dest: "uploads/" });
const outputRoot = fileURLToPath(new URL("../generated/", import.meta.url));

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function runMulterMiddleware(req, res, fn) {
  return new Promise((resolvePromise, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolvePromise(result);
    });
  });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Ukuran permintaan terlalu besar.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Body harus berupa JSON yang valid.");
    error.statusCode = 400;
    throw error;
  }
}

export async function handleAgentRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method tidak diizinkan." });
    return;
  }

  const pathname = new URL(request.url, "http://localhost").pathname;

  try {
    if (pathname === "/api/agent") {
      // Jalankan multer untuk menangkap file upload & teks form
      await runMulterMiddleware(request, response, upload.fields([
        { name: 'customBacksound', maxCount: 1 }
      ]));

      // Ambil data dengan aman dari request.body
      const body = request.body || {};
      const topic = String(body.topic || "").trim();
      
      if (!topic || topic.length > 400) {
        sendJson(response, 400, { error: "Topik wajib diisi (maksimal 400 karakter)." });
        return;
      }

      const tone = String(body.tone || "informatif dan menarik").slice(0, 100);
      const audience = String(body.audience || "penonton TikTok Indonesia").slice(0, 120);
      
      // PASTIKAN AUDIO MODE DIAMBIL DENGAN BENAR (fallback ke tts_and_music jika undefined)
      const audioMode = String(body.audioMode || "tts_and_music").trim();
      const totalDuration = parseInt(body.totalDuration, 10) || 15;
      
      const customAudioFile = request.files?.customBacksound?.[0];

      console.log(`🎬 [API] Memproses video | Topik: "${topic}" | Mode Audio: "${audioMode}" | Durasi: ${totalDuration}s`);

      const project = await createContentProject({
        topic,
        tone,
        audience,
        audioMode,
        customAudioFile,
        totalDuration,
      });

      sendJson(response, 201, project);
      return;
    }

    if (pathname === "/api/tiktok/draft") {
      const body = await readJson(request);
      const videoId = String(body.videoId || "");
      if (!/^[a-f0-9-]{36}$/i.test(videoId)) {
        sendJson(response, 400, { error: "ID video tidak valid." });
        return;
      }

      const videoPath = resolve(outputRoot, videoId, "video.mp4");
      if (!videoPath.startsWith(outputRoot)) {
        sendJson(response, 400, { error: "Lokasi video tidak valid." });
        return;
      }

      const uploadResult = await uploadVideoToTikTokDraft(videoPath);
      sendJson(response, 200, uploadResult);
      return;
    }

    sendJson(response, 404, { error: "Endpoint tidak ditemukan." });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Terjadi kesalahan saat memproses permintaan.",
    });
  }
}