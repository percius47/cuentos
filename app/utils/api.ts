import { StoryFormData } from "../components/StoryForm";

// Client-side logging helper
function logApiOperation(operation: string, data: any = null) {
  console.group(`🌟 API Operation: ${operation}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  if (data) {
    console.log("📄 Data:", data);
  }
  console.groupEnd();
}

// Generate story text using our API route
export async function generateStory(formData: StoryFormData): Promise<{
  title: string;
  pages: { text: string; imageUrl: string }[];
  characterDescriptions?: Record<string, any>;
}> {
  try {
    logApiOperation("Starting story generation request", {
      childName: formData.childName,
      theme: formData.theme,
      style: formData.style,
    });

    console.time("✨ Story Generation - Total Time");
    const response = await fetch("/api/generate-story", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logApiOperation("Story generation failed", {
        status: response.status,
        error: errorData.error,
      });
      throw new Error(errorData.error || "Failed to generate story");
    }

    const result = await response.json();
    console.timeEnd("✨ Story Generation - Total Time");

    logApiOperation("Story generation completed", {
      title: result.title,
      pageCount: result.pages.length,
      characterCount: result.characterDescriptions
        ? Object.keys(result.characterDescriptions).length
        : 0,
    });

    return result;
  } catch (error) {
    console.error("Error generating story:", error);
    throw new Error("Failed to generate story. Please try again.");
  }
}

// Since our API route now handles image generation, we don't need these functions
// but keeping them for future implementation of more advanced features
export async function generateImagePrompts(
  storyData: { title: string; pages: { text: string }[] },
  style: string
): Promise<string[]> {
  // This would be implemented in a more advanced version
  // For now, just return empty prompts since the API route handles image generation
  return storyData.pages.map(() => "");
}

export async function generateImages(
  imagePrompts: string[],
  style: string
): Promise<string[]> {
  // This would be implemented in a more advanced version
  // For now, just return empty URLs since the API route handles image generation
  return imagePrompts.map(() => "");
}

// Helper functions for theme and style descriptions
function getThemeDescription(theme: string): string {
  const themeMap: Record<string, string> = {
    moral:
      "a journey that teaches important life lessons about honesty, kindness, responsibility, perseverance, or courage. The story should include a clear moral challenge that the main character overcomes, learning a valuable lesson that's expressed in a child-friendly way. The message should be woven naturally into the story rather than stated explicitly.",

    social:
      "developing friendship, cooperation, and social skills. The story should feature interactions with other characters where the main character learns to share, communicate effectively, resolve conflicts peacefully, or work as part of a team. The narrative should show positive examples of healthy relationships and emotional intelligence appropriate for young children.",

    knowledge:
      "an adventure that introduces educational concepts about the world, science, art, history, or how things work. The story should incorporate fascinating facts and discoveries that spark curiosity while remaining engaging and accessible to children. Educational elements should be seamlessly integrated into the plot rather than presented as lessons.",

    fantasy:
      "an imaginative journey with magical or fantastical elements, where the extraordinary becomes possible. The story should transport the reader to a world with unique rules, magical creatures, enchanted objects, or special powers. The fantasy elements should enhance the narrative and create a sense of wonder while maintaining an emotionally resonant core story.",
  };
  return (
    themeMap[theme] ||
    "a fun and engaging adventure with memorable characters and an uplifting message"
  );
}

function getStyleDescription(style: string): string {
  const styleMap: Record<string, string> = {
    pixar:
      "3D Pixar-style animation with rounded, expressive characters, realistic lighting effects, and highly detailed textures. The illustrations should have depth and dimension, warm color palette, soft shadows, and a slightly stylized but believable world with meticulous attention to environmental details. Characters should have exaggerated facial expressions that clearly convey emotions.",

    watercolor:
      "soft, dreamy watercolor paintings with delicate brushstrokes, gentle color washes, and subtle blending. The illustrations should have a translucent quality with visible paper texture, bleeding colors, and artistic imperfections. The palette should be soft and harmonious with a light, airy feel, using white space effectively. Edges should be fluid rather than sharp, creating a gentle, contemplative mood.",

    cartoon:
      "bright, playful cartoon-style with bold outlines, vibrant flat colors, and simplified shapes. The illustrations should be energetic with exaggerated proportions, dynamic poses, and strong silhouettes. Character designs should be distinctive and memorable with clear shapes and expressive faces. The overall look should be cheerful and lively with a sense of movement and fun.",

    storybook:
      "classic children's book illustrations with rich details, traditional techniques, and a timeless quality. The illustrations should feature careful attention to composition, balanced color schemes, and fine decorative elements. Character designs should be charming and relatable with warm, inviting environments. The style should evoke nostalgia while remaining fresh and engaging, with a perfect balance of detail and simplicity.",
  };
  return (
    styleMap[style] ||
    "colorful and engaging children's book illustrations with appealing characters and rich, detailed backgrounds that complement the story perfectly"
  );
}
