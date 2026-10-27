import { readFile, stat } from "node:fs/promises";

const initUrl = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const megabyte = 1024 * 1024;

export async function uploadVideoToTikTokDraft(videoPath) {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    const error = new Error("TIKTOK_ACCESS_TOKEN belum diatur. Tambahkan token OAuth dengan scope video.upload ke .env.");
    error.statusCode = 503;
    throw error;
  }

  const { size } = await stat(videoPath);
  const chunkSize = size < 5 * megabyte ? size : 10 * megabyte;
  const totalChunkCount = Math.ceil(size / chunkSize);
  const initResponse = await fetch(initUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const initResult = await initResponse.json().catch(() => ({}));
  if (!initResponse.ok || initResult.error?.code !== "ok") {
    throw new Error(initResult.error?.message || `TikTok menolak inisialisasi upload (${initResponse.status}).`);
  }

  const uploadUrl = initResult.data?.upload_url;
  if (!uploadUrl || new URL(uploadUrl).protocol !== "https:") {
    throw new Error("TikTok tidak memberikan URL upload HTTPS yang valid.");
  }

  const video = await readFile(videoPath);
  for (let start = 0; start < size; start += chunkSize) {
    const end = Math.min(start + chunkSize, size) - 1;
    const chunk = video.subarray(start, end + 1);
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
      body: chunk,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Upload video ke TikTok gagal (${uploadResponse.status}).`);
    }
  }

  return {
    publishId: initResult.data?.publish_id,
    message: "Video dikirim ke Inbox TikTok. Selesaikan dan publikasikan dari aplikasi TikTok.",
  };
}