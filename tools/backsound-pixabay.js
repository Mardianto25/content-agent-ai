import { writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const audioDir = resolve(root, "assets", "audio");

async function getLocalFallbackAudio() {
  try {
    const files = await readdir(audioDir);
    const mp3Files = files.filter(file => file.endsWith(".mp3"));

    if (mp3Files.length > 0) {
      const randomFile = mp3Files[Math.floor(Math.random() * mp3Files.length)];
      console.log(`📁 Menggunakan backsound lokal dari assets/audio: ${randomFile}`);
      return join(audioDir, randomFile);
    }
  } catch {
    // Abaikan jika folder belum ada
  }
  return resolve(root, "backsound.mp3");
}

export async function getBacksoundPath(projectDir, mood, customAudioFile) {
  // Jika Anda mengunggah file MP3 kustom dari UI, gunakan file tersebut!
  if (customAudioFile && customAudioFile.path) {
    console.log(`🎵 Menggunakan backsound kustom unggahan pengguna: ${customAudioFile.path}`);
    return customAudioFile.path;
  }

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ PIXABAY_API_KEY kosong. Menggunakan backsound lokal.");
    return await getLocalFallbackAudio();
  }

  const endpoint = `https://pixabay.com/api/audio/?key=${apiKey}&q=${encodeURIComponent(mood)}&per_page=5`;

  try {
    console.log(`🎶 Mencari backsound di Pixabay dengan tema: "${mood}"...`);
    const response = await fetch(endpoint);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pixabay menolak (Status ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.hits && data.hits.length > 0) {
      const randomTrack = data.hits[Math.floor(Math.random() * data.hits.length)];
      const audioUrl = randomTrack.audio; 

      if (!audioUrl) throw new Error("URL audio tidak ditemukan.");

      console.log(`📥 Mengunduh backsound: "${randomTrack.title || 'Audio'}" dari Pixabay...`);
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error("Gagal mengunduh file audio.");

      const arrayBuffer = await audioRes.arrayBuffer();
      const localBacksoundPath = join(projectDir, "backsound.mp3");
      
      await writeFile(localBacksoundPath, Buffer.from(arrayBuffer));
      console.log(`✅ Backsound Pixabay berhasil disimpan.`);
      return localBacksoundPath;
    } else {
      console.warn("⚠️ Tidak ditemukan musik di Pixabay, beralih ke lokal.");
      return await getLocalFallbackAudio();
    }
  } catch (error) {
    console.warn(`⚠️ Gagal mengambil backsound Pixabay (${error.message}). Beralih ke folder lokal.`);
    return await getLocalFallbackAudio();
  }
}