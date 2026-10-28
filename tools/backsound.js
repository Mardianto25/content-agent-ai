import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const audioDir = resolve(root, "assets", "audio");

export async function getRandomBacksound() {
  try {
    const files = await readdir(audioDir);
    const mp3Files = files.filter(file => file.endsWith(".mp3"));

    if (mp3Files.length === 0) {
      console.warn("⚠️ Tidak ada file .mp3 di folder assets/audio. Menggunakan fallback lokal.");
      return resolve(root, "backsound.mp3"); // Fallback ke file utama jika folder kosong
    }

    // Pilih file musik secara acak dari daftar yang tersedia
    const randomFile = mp3Files[Math.floor(Math.random() * mp3Files.length)];
    const selectedPath = join(audioDir, randomFile);
    
    console.log(`🎶 Agen memilih backsound otomatis: ${randomFile}`);
    return selectedPath;
  } catch (error) {
    console.warn("⚠️ Gagal membaca folder audio, menggunakan backsound default.");
    return resolve(root, "backsound.mp3");
  }
}