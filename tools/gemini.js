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
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const result = await callGemini(model, {
    contents: [{
      parts: [{
        text: `Buat konsep video TikTok vertikal berbahasa Indonesia tentang: ${topic}\nGaya: ${tone}. Target penonton: ${audience}.\nBalas JSON saja dengan bentuk: {"title":"judul singkat","caption":"caption TikTok","hashtags":["tag1"],"scenes":[{"overlay":"teks layar maksimal 8 kata","narration":"naskah narasi 1-2 kalimat","visualPrompt":"deskripsi gambar visual dalam bahasa Inggris, portrait 9:16, tanpa teks, tanpa logo"}]}\nBuat tepat 3 adegan. Pastikan visual tiap adegan berbeda dan naskah aman, faktual, serta ringkas.`,
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