  import { randomUUID } from "node:crypto";
  import { generateSceneImage, generateStory } from "./gemini.js";
  import { renderVideo } from "./video.js";

  export async function createContentProject(input) {
    const story = await generateStory(input);
    const images = [];

    for (const scene of story.scenes) {
      images.push(await generateSceneImage(scene.visualPrompt));
    }

    const id = randomUUID();
    // Meneruskan musicKeyword ke fungsi renderVideo
    const video = await renderVideo({ 
      id, 
      scenes: story.scenes, 
      images, 
      musicKeyword: story.musicKeyword 
    });

    return {
      id,
      title: story.title,
      caption: story.caption,
      hashtags: story.hashtags,
      scenes: story.scenes.map(({ overlay, narration }) => ({ overlay, narration })),
      ...video,
    };
  }