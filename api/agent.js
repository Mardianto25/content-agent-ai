import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContentProject } from "../tools/pipeline.js";
import { uploadVideoToTikTokDraft } from "../tools/tiktok-api.js";

const outputRoot = fileURLToPath(new URL("../generated/", import.meta.url));

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
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
    const body = await readJson(request);

    if (pathname === "/api/agent") {
      const topic = String(body.topic || "").trim();
      if (!topic || topic.length > 400) {
        sendJson(response, 400, { error: "Topik wajib diisi (maksimal 400 karakter)." });
        return;
      }

      const project = await createContentProject({
        topic,
        tone: String(body.tone || "informatif dan menarik").slice(0, 100),
        audience: String(body.audience || "penonton TikTok Indonesia").slice(0, 120),
      });
      sendJson(response, 201, project);
      return;
    }

    if (pathname === "/api/tiktok/draft") {
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

      const upload = await uploadVideoToTikTokDraft(videoPath);
      sendJson(response, 200, upload);
      return;
    }

    sendJson(response, 404, { error: "Endpoint tidak ditemukan." });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Terjadi kesalahan saat memproses permintaan.",
    });
  }
}