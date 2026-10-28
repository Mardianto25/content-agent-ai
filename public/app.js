import { generateContent } from "/tools/generator.js";
import { formatTikTokCaption, uploadTikTokDraft } from "/tools/tiktok.js";

const form = document.querySelector("#brief-form");
const generateButton = document.querySelector("#generate-button");
const draftButton = document.querySelector("#draft-button");
const emptyState = document.querySelector("#empty-state");
const resultState = document.querySelector("#result-state");
const statusLine = document.querySelector("#status-line");
const outputBadge = document.querySelector("#output-badge");
let currentProject;

function showStatus(message, kind = "info") {
  statusLine.textContent = message;
  statusLine.dataset.kind = kind;
  statusLine.hidden = false;
}

function appendSceneScript(scenes) {
  const container = document.querySelector("#scene-script");
  container.replaceChildren();

  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "script-row";
    const number = document.createElement("span");
    number.className = "script-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const overlay = document.createElement("strong");
    overlay.textContent = scene.overlay;
    const narration = document.createElement("p");
    narration.textContent = scene.narration;
    copy.append(overlay, narration);
    row.append(number, copy);
    container.append(row);
  });
}

function renderProject(project) {
  currentProject = project;
  document.querySelector("#result-title").textContent = project.title;
  document.querySelector("#result-caption").textContent = formatTikTokCaption(project.caption, project.hashtags);
  const video = document.querySelector("#video-preview");
  video.src = project.videoUrl;
  video.load();

  const strip = document.querySelector("#scene-strip");
  strip.replaceChildren();
  project.imageUrls.forEach((url, index) => {
    const frame = document.createElement("figure");
    frame.className = "scene-frame";
    const image = document.createElement("img");
    image.src = url;
    image.alt = `Visual adegan ${index + 1}`;
    const number = document.createElement("figcaption");
    number.textContent = `FRAME 0${index + 1}`;
    frame.append(image, number);
    strip.append(frame);
  });

  appendSceneScript(project.scenes);
  emptyState.hidden = true;
  resultState.hidden = false;
  outputBadge.textContent = `${project.durationSeconds} DETIK · SIAP`;
  draftButton.disabled = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  generateButton.querySelector(".button-label").textContent = "Sedang merancang...";
  outputBadge.textContent = "SEDANG DIRANCANG";
  showStatus("Gemini sedang menulis naskah, merakit audio, dan merender video. Proses ini bisa memakan waktu beberapa menit.");

  const formData = new FormData(form);
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      body: formData, // Kirim seluruh form termasuk file mp3 dan durasi total
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Gagal memproses permintaan di server.");
    }

    renderProject(result);
    showStatus("Video selesai dirender. Tinjau hasilnya sebelum mengirim ke TikTok.", "success");
  } catch (error) {
    outputBadge.textContent = "PERLU PERHATIAN";
    showStatus(error.message, "error");
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector(".button-label").textContent = "Rancang video";
  }
});

draftButton.addEventListener("click", async () => {
  if (!currentProject) return;
  draftButton.disabled = true;
  draftButton.querySelector(".button-label").textContent = "Mengirim...";
  showStatus("Mengunggah video ke Inbox TikTok...");

  try {
    const result = await uploadTikTokDraft(currentProject.id);
    showStatus(result.message, "success");
    draftButton.querySelector(".button-label").textContent = "Terkirim ke Inbox";
  } catch (error) {
    showStatus(error.message, "error");
    draftButton.disabled = false;
    draftButton.querySelector(".button-label").textContent = "Kirim ke Draft TikTok";
  }
});