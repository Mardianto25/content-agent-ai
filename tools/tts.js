import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import googleTTS from "google-tts-api";

export async function generateNarrationAudio(narrationText, outputPath) {
  try {
    // Mendapatkan URL audio base64 dari Google TTS
    const base64Audio = await googleTTS.getAudioBase64(narrationText, {
      lang: 'id', // Bahasa Indonesia
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    // Simpan sebagai file MP3 di direktori proyek adegan
    const buffer = Buffer.from(base64Audio, 'base64');
    await writeFile(outputPath, buffer);
    return outputPath;
  } catch (error) {
    console.error(`⚠️ Gagal generate TTS untuk: "${narrationText}" -> ${error.message}`);
    return null;
  }
}