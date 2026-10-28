const apiBase = "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error("GEMINI_API_KEY belum diatur di file .env.");
    error.statusCode = 503;
    throw error;
  }
  return key;
}

async function callGemini(model, payload) {
  const response = await fetch(
    `${apiBase}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getApiKey(),
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `Gemini gagal (${response.status}).`);
    error.statusCode = 502;
    throw error;
  }
  return result;
}

function parseJsonText(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemini tidak mengembalikan JSON naskah.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function generateStory({ topic, tone, audience }) {
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";
  const result = await callGemini(model, {
    contents: [{
      parts: [{
        text: `Buat konsep video TikTok vertikal berbahasa Indonesia tentang: ${topic}\nGaya: ${tone}. Target penonton: ${audience}.\nBalas JSON saja dengan bentuk: {"title":"judul singkat","caption":"caption TikTok","hashtags":["tag1"],"musicKeyword":"kata kunci musik latar dalam bahasa Inggris yang cocok untuk tema ini (contoh: upbeat corporate, lofi chill, cinematic dramatic, energic electronic)","scenes":[{"overlay":"teks layar maksimal 8 kata","narration":"naskah narasi 1-2 kalimat","visualPrompt":"deskripsi gambar visual dalam bahasa Inggris, portrait 9:16, tanpa teks, tanpa logo"}]}\nBuat tepat 3 adegan. Pastikan visual tiap adegan berbeda dan naskah aman, faktual, serta ringkas.`,
      }],
    }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  });

  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");
  if (!text) throw new Error("Gemini tidak menghasilkan naskah.");

  const story = parseJsonText(text);
  if (!Array.isArray(story.scenes) || story.scenes.length < 3) {
    throw new Error("Naskah Gemini belum berisi tiga adegan.");
  }

  return {
    title: String(story.title || topic).slice(0, 120),
    caption: String(story.caption || "").slice(0, 2200),
    musicKeyword: String(story.musicKeyword || "upbeat lofi").slice(0, 100), // <-- Kata kunci musik dari Gemini
    hashtags: Array.isArray(story.hashtags)
      ? story.hashtags.slice(0, 8).map((tag) => String(tag).replace(/^#/, ""))
      : [],
    scenes: story.scenes.slice(0, 3).map((scene) => ({
      overlay: String(scene.overlay || "").slice(0, 100),
      narration: String(scene.narration || "").slice(0, 500),
      visualPrompt: String(scene.visualPrompt || topic).slice(0, 1000),
    })),
  };
}

/* ==========================================================
   DI-COMMENT: Kode asli Gemini Image (tidak digunakan sementara)
   ==========================================================
export async function generateSceneImage(prompt) {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const result = await callGemini(model, {
    contents: [{ parts: [{ text: `${prompt}. Cinematic lighting, polished editorial composition.` }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  const image = result.candidates?.[0]?.content?.parts
    ?.find((part) => part.inlineData?.data)?.inlineData;
  if (!image) throw new Error("Gemini tidak mengembalikan gambar untuk salah satu adegan.");

  return {
    data: Buffer.from(image.data, "base64"),
    mimeType: image.mimeType || "image/png",
  };
}
========================================================== */

// PENGGANTI: Menggunakan Pollinations.ai berbasis URL (Gratis & Tanpa API Key)
export async function generateSceneImage(prompt) {
  // Membersihkan prompt dari karakter yang berpotensi merusak URL
  const cleanPrompt = (prompt || "cinematic background").replace(/[^\w\s,]/gi, '');
  const encodedPrompt = encodeURIComponent(`${cleanPrompt}, cinematic lighting, 8k, photorealistic, vertical 9:16`);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true`;

  console.log(`🌐 Mengambil gambar dari Pollinations: ${imageUrl}`);

  try {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Pollinations mengembalikan status HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      data: Buffer.from(arrayBuffer),
      mimeType: "image/jpeg",
    };
  } catch (error) {
    console.error(`⚠️ Gagal memuat dari Pollinations.ai: ${error.message}. Menggunakan gambar cadangan...`);
    
    // Cadangan darurat (Fallback): Menggunakan gambar placeholder publik jika Pollinations sedang gangguan
    const fallbackResponse = await fetch("https://picsum.photos/1080/1920");
    const fallbackBuffer = await fallbackResponse.arrayBuffer();
    
    return {
      data: Buffer.from(fallbackBuffer),
      mimeType: "image/jpeg",
    };
  }
}