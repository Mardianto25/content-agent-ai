export async function generateContent(input) {
  return postJson("/api/agent", input);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  }

  return result;
}