export function formatTikTokCaption(caption, hashtags = []) {
  const tags = hashtags
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`);

  return [caption.trim(), ...tags].filter(Boolean).join("\n\n");
}

export async function uploadTikTokDraft(videoId) {
  const response = await fetch("/api/tiktok/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Upload gagal (${response.status}).`);
  }

  return result;
}