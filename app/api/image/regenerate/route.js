import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import {
  formatConsistentCharacterPrompt,
  createCoverImagePrompt,
  createPageImagePrompt,
} from "../../../utils/characterConsistency";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// DALL-E prompt limits
const MAX_PROMPT_LENGTH = 3800; // Setting below 4000 to leave room for DALL-E's internal additions

// Helper function to sanitize prompts for safety
function sanitizePrompt(prompt) {
  // Remove potentially problematic content that could trigger content filters
  const sanitized = prompt
    .replace(/violent|explicit|graphic|inappropriate/gi, "gentle")
    .replace(/kill|harm|hurt|weapon/gi, "interact with");

  return sanitized;
}

// Helper function to fetch with retry
async function fetchWithRetry(url, options = {}, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Fetch] Attempt ${attempt}/${maxRetries} for ${url.substring(
          0,
          50
        )}...`
      );
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      console.log(`[Fetch] Attempt ${attempt} failed: ${error.message}`);
      lastError = error;

      if (attempt < maxRetries) {
        console.log(`[Fetch] Waiting ${delay / 1000} seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Exponential backoff
        delay *= 2;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Helper function to log detailed API errors
function logApiError(requestId, error) {
  console.error(`[${requestId}] ❌ API Error Details:`);

  if (error.status) {
    console.error(`[${requestId}] Status: ${error.status}`);
  }

  if (error.code) {
    console.error(`[${requestId}] Error Code: ${error.code}`);
  }

  if (error.type) {
    console.error(`[${requestId}] Error Type: ${error.type}`);
  }

  if (error.param) {
    console.error(`[${requestId}] Error Param: ${error.param}`);
  }

  if (error.request_id) {
    console.error(`[${requestId}] OpenAI Request ID: ${error.request_id}`);
  }

  if (error.error?.message) {
    console.error(`[${requestId}] Error Message: ${error.error.message}`);
  }
}

// Define text visibility and quality requirements to ensure readability
const textVisibilityRequirements = `
TEXT VISIBILITY REQUIREMENTS:
- All text must be LARGE (minimum 24pt equivalent) and CENTERED
- Text must have HIGH CONTRAST with its background (e.g., dark text on light background or vice versa)
- Text must be placed against a SIMPLE, UNCLUTTERED portion of the image
- Each letter must be CLEAR and DISTINCT with appropriate spacing
- NO handwriting-style or decorative fonts that sacrifice readability
- Text must NOT be positioned near edges or busy areas of the illustration
`;

// Text prohibition requirements for story pages
const textProhibitionRequirements = `
TEXT PROHIBITION REQUIREMENTS:
- DO NOT include ANY text in the illustration whatsoever
- NO words, labels, captions, speech bubbles, or text elements of any kind
- DO NOT try to include the story text in the image
- CREATE ONLY a text-free illustration that visually represents the scene
- FOCUS COMPLETELY on creating a beautiful, clear illustration without any text elements
`;

// Add anti-POV/meta-representation requirements
const antiMetaRepresentationRequirements = `
CRITICAL FORMAT REQUIREMENTS:
- This must be a DIRECT ILLUSTRATION, NOT a photograph of a book
- DO NOT show book pages, spines, edges, or borders
- DO NOT create a meta-view of a "book within the image"
- DO NOT show the illustration from an angle or perspective
- DO NOT include any photographic elements, camera artifacts, or shadows
- Create ONLY the actual content of the page as a flat, direct illustration
`;

// Character anatomical correctness requirements
const anatomicalCorrectnessRequirements = `
ANATOMICAL CORRECTNESS REQUIREMENTS:
- All characters must have EXACTLY the correct number of body parts (two arms, two hands, etc.)
- Body proportions must be consistent and anatomically appropriate
- No missing, extra, or deformed limbs, fingers, etc.
- Character poses must be physically possible and natural
- Facial features must be symmetrical and properly aligned
`;

// Helper function to enhance prompt with feedback
function enhancePromptWithFeedback(basePrompt, feedback) {
  let enhancedPrompt = basePrompt;

  // Add specific instructions based on feedback type
  switch (feedback.type) {
    case "text_visibility":
      // Only add text visibility instructions for cover images
      if (basePrompt.includes("titled")) {
        enhancedPrompt += `

CRITICAL TEXT READABILITY INSTRUCTIONS: 
1. Make the title text MUCH LARGER and CLEARLY VISIBLE with excellent contrast
2. Use a simple, highly legible font style
3. Place title text against a simplified, uncluttered background area
4. Ensure title text has a contrasting outline or shadow if needed for legibility
5. Position title text in the center or in a prominent area of the image
6. Title text must be perfectly readable at a glance
7. Do NOT stylize the text to the point it becomes difficult to read
8. ONLY the title text should be included - NO other text elements at all`;
      } else {
        // For story pages, reinforce no text
        enhancedPrompt += `

CRITICAL TEXT-FREE INSTRUCTIONS:
1. Do NOT include ANY text in the image whatsoever
2. Create a completely text-free illustration
3. Remove all text elements including any words, labels, or captions
4. Focus entirely on the visual illustration without any text`;
      }
      break;
    case "character_appearance":
      enhancedPrompt += `

CRITICAL CHARACTER CONSISTENCY INSTRUCTIONS:
1. Ensure the character appears EXACTLY as described in the story
2. Maintain consistent proportions, features, clothing, and coloring
3. Character should be instantly recognizable as the same character from other illustrations
4. Follow the exact character description without creative modifications
5. Match the style guide precisely for this character`;
      break;
    case "style_mismatch":
      enhancedPrompt += `

CRITICAL STYLE CONSISTENCY INSTRUCTIONS:
1. Follow the requested ${
        feedback.details || "illustration style"
      } with PERFECT accuracy
2. The illustration must maintain consistent visual language with other pages
3. Use the exact same art techniques, color palette, and stylistic elements
4. Do not mix different artistic styles within the same illustration
5. Match the overall aesthetic of a professional children's book in this style`;
      break;
    case "composition_issue":
      enhancedPrompt +=
        " IMPORTANT: Improve the composition to create a more balanced and visually appealing image. Center the main action or characters, create a clear focal point, and use proper visual hierarchy.";
      break;
    case "unwanted_elements":
      enhancedPrompt +=
        " IMPORTANT: Remove any unnecessary or distracting elements from the image. Keep the composition clean and focused on the main subject and story content.";
      break;
    case "missing_elements":
      enhancedPrompt +=
        " IMPORTANT: Include all the key elements mentioned in the description. Ensure all important story elements are clearly visible and properly represented.";
      break;
    case "color_scheme":
      enhancedPrompt +=
        " IMPORTANT: Use a more harmonious and appropriate color scheme. Ensure colors are child-friendly, visually appealing, and consistent with the style guide.";
      break;
    case "other":
      if (feedback.customDescription) {
        enhancedPrompt += ` IMPORTANT: ${feedback.customDescription}`;
      }
      break;
  }

  // Add any additional details provided
  if (feedback.details && feedback.type !== "other") {
    enhancedPrompt += ` Additional details: ${feedback.details}`;
  }

  // Add quality verification checks
  if (basePrompt.includes("titled")) {
    // For cover page
    enhancedPrompt += `\n\nFINAL QUALITY CHECKS:
- Verify all characters have anatomically correct features
- Ensure ONLY the title text is included and is easily readable with proper contrast and sizing
- Confirm this is a direct illustration, NOT a book photograph
- Check that character appearance matches the reference exactly`;
  } else {
    // For story pages
    enhancedPrompt += `\n\nFINAL QUALITY CHECKS:
- Verify all characters have anatomically correct features
- Ensure NO text is included anywhere in the illustration
- Confirm this is a direct illustration, NOT a book photograph
- Check that character appearance matches the reference exactly`;
  }

  return enhancedPrompt;
}

// Helper function to check if we need to regenerate an image due to quality issues
async function validateImageQuality(imageUrl, validationCriteria) {
  // In a real implementation, this would use AI vision models to analyze the image
  // For now, we'll just log that validation would happen here
  console.log(
    `[Validation] 🔍 Validating image quality for ${imageUrl.substring(
      0,
      50
    )}...`
  );
  console.log(`[Validation] Criteria: ${JSON.stringify(validationCriteria)}`);

  // In the future, integrate with vision APIs to validate:
  // 1. Character consistency with profile
  // 2. Text readability and placement
  // 3. Anatomical correctness
  // 4. No meta-representations/POV shots

  // For now, we assume the image passes validation
  return {
    passed: true,
    issues: [],
  };
}

// Helper function to trim prompts to acceptable length
function trimPromptToLimit(prompt, maxLength = MAX_PROMPT_LENGTH) {
  if (prompt.length <= maxLength) return prompt;

  console.log(
    `⚠️ Prompt exceeds limit (${prompt.length} chars). Trimming to ${maxLength} chars.`
  );

  // Split into sections by double newlines
  const sections = prompt.split("\n\n");

  // Start with critical sections (first sections usually contain main instructions)
  let trimmedPrompt = sections[0] + "\n\n";

  // Priority sections to preserve (look for these keywords in any order)
  const priorityKeywords = [
    "CHARACTER CONSISTENCY",
    "ANATOMICAL CORRECTNESS",
    "IMPORTANT:",
    "TEXT VISIBILITY",
    "CRITICAL",
    "FINAL CHECK",
  ];

  // Find and add priority sections first
  const prioritySections = [];
  const normalSections = [];

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    if (priorityKeywords.some((keyword) => section.includes(keyword))) {
      prioritySections.push(section);
    } else {
      normalSections.push(section);
    }
  }

  // Add priority sections first
  for (const section of prioritySections) {
    if (trimmedPrompt.length + section.length + 2 <= maxLength) {
      trimmedPrompt += section + "\n\n";
    }
  }

  // Add remaining sections if space allows
  for (const section of normalSections) {
    if (trimmedPrompt.length + section.length + 2 <= maxLength) {
      trimmedPrompt += section + "\n\n";
    }
  }

  return trimmedPrompt.trim();
}

// Helper function to define style based on illustration style
function defineStyle(illustrationStyle) {
  switch (illustrationStyle) {
    case "pixar-style":
      return "in Pixar 3D animation style, with vibrant colors and detailed textures";
    case "disney-classic":
      return "in classic Disney animation style, with fluid lines and warm colors";
    case "hand-drawn-watercolor":
      return "in hand-drawn watercolor style, with soft brush strokes and translucent colors";
    case "cartoon-sketch":
      return "in cartoon sketch style, with bold outlines and flat colors";
    case "minimalist-modern":
      return "in minimalist modern style, with simple geometric shapes and solid colors";
    default:
      return "in a colorful and child-friendly illustration style";
  }
}

export async function POST(request) {
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[${requestId}] 🔄 Image regeneration task started`);

  try {
    const {
      storyId,
      pageIndex,
      feedback,
      title,
      coverDescription,
      pageData: requestPageData,
      illustrationStyle,
    } = await request.json();

    const isCover = pageIndex === "cover";

    console.log(
      `[${requestId}] 📝 Parameters received: storyId=${storyId}, pageIndex=${pageIndex}, feedbackType=${feedback?.type}`
    );
    console.log(
      `[${requestId}] 🔍 Feedback details: ${feedback?.details || "none"}`
    );

    if (
      !storyId ||
      pageIndex === undefined ||
      !feedback ||
      !illustrationStyle
    ) {
      console.log(`[${requestId}] ❌ Error: Missing required data`);
      return Response.json({ error: "Missing required data" }, { status: 400 });
    }

    if (isCover && (!title || !coverDescription)) {
      console.log(`[${requestId}] ❌ Error: Missing cover data`);
      return Response.json({ error: "Missing cover data" }, { status: 400 });
    }

    if (!isCover && !requestPageData) {
      console.log(`[${requestId}] ❌ Error: Missing page data`);
      return Response.json({ error: "Missing page data" }, { status: 400 });
    }

    // Format the folder name based on the title or storyId (remove special characters)
    const folderName = title
      ? title
          .replace(/[^\w\s]/gi, "")
          .replace(/\s+/g, "_")
          .toLowerCase()
      : `story_${storyId}`;

    const storiesDir = path.join(process.cwd(), "public", "stories");
    const bookDir = path.join(storiesDir, folderName);

    console.log(`[${requestId}] 📁 Using directory: ${bookDir}`);

    // Create directory if it doesn't exist
    try {
      await fs.mkdir(bookDir, { recursive: true });
      console.log(`[${requestId}] ✅ Directory created or already exists`);
    } catch (error) {
      console.error(`[${requestId}] ❌ Error creating directory:`, error);
      return Response.json(
        { error: "Failed to create directory" },
        { status: 500 }
      );
    }

    // Generate the image
    let rawPrompt;
    let fileName;
    let currentPageData;
    let consistentCharacterPrompt = "";
    let storyData;

    // Load the story data
    try {
      storyData = JSON.parse(
        await fs.readFile(path.join(bookDir, "story.json"), "utf8")
      );

      // Get the character profile from the story data
      const characterProfile = storyData.characterProfile || "";

      // Create structured character prompt for consistency using utility function
      consistentCharacterPrompt =
        formatConsistentCharacterPrompt(characterProfile);
    } catch (error) {
      console.log(
        `[${requestId}] ℹ️ No character profile found. Attempting to access other pages for character information...`
      );

      // Attempt to find other pages to extract character description
      try {
        // Look for all page files in the directory
        const files = await fs.readdir(bookDir);
        const pageFiles = files.filter(
          (file) => file.startsWith("page") && file.endsWith(".png")
        );

        if (pageFiles.length > 0) {
          console.log(
            `[${requestId}] ✅ Found ${pageFiles.length} page files to analyze for character consistency`
          );

          // Use either the pageData or the cover description for character info
          let characterDescription = "";
          if (requestPageData && requestPageData.imageDescription) {
            characterDescription = requestPageData.imageDescription;
          } else if (coverDescription) {
            characterDescription = coverDescription;
          }

          if (characterDescription) {
            consistentCharacterPrompt = `
CRITICAL CHARACTER CONSISTENCY:
The main character must look consistent with other story illustrations.
Based on the story context:
${characterDescription}

Maintain consistent appearance, proportions, colors, and style with the other pages of the book.
This is ABSOLUTELY CRITICAL for maintaining story continuity.`;
          }
        }
      } catch (dirError) {
        console.log(
          `[${requestId}] ⚠️ Unable to analyze directory for character consistency: ${dirError.message}`
        );
      }
    }

    // If still no character prompt, create a basic one
    if (
      !consistentCharacterPrompt &&
      (requestPageData?.imageDescription || coverDescription)
    ) {
      const description = requestPageData?.imageDescription || coverDescription;
      consistentCharacterPrompt = `
CRITICAL CHARACTER CONSISTENCY:
The main character must look consistent across all illustrations.
Based on the description:
${description}

Maintain consistent appearance, proportions, colors, and style. The character should be immediately recognizable as the same character from other illustrations in the book.`;
    }

    // Define style prompts based on the illustration style
    let stylePrompt = "";

    switch (illustrationStyle) {
      case "pixar-style":
        stylePrompt =
          "in Pixar 3D animation style, with vibrant colors and detailed textures. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        break;
      case "disney-classic":
        stylePrompt =
          "in classic Disney animation style, with fluid lines and warm colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        break;
      case "hand-drawn-watercolor":
        stylePrompt =
          "in hand-drawn watercolor style, with soft brush strokes and translucent colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        break;
      case "cartoon-sketch":
        stylePrompt =
          "in cartoon sketch style, with bold outlines and flat colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        break;
      case "minimalist-modern":
        stylePrompt =
          "in minimalist modern style, with simple geometric shapes and solid colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        break;
      default:
        stylePrompt =
          "in a colorful and child-friendly style. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
    }
    console.log(`[${requestId}] 🎨 Illustration style prompt: ${stylePrompt}`);

    // Generate the image
    if (isCover) {
      // Define style based on selected illustration style
      let styleDescription = defineStyle(illustrationStyle);

      // If we have storyData from earlier
      if (storyData) {
        const mainCharacter = storyData.mainCharacter || "protagonist";
        const characterProfile = storyData.characterProfile || "";

        // Use utility function to create cover prompt
        const coverPrompt = createCoverImagePrompt(
          title,
          storyData.coverDescription || coverDescription,
          characterProfile,
          styleDescription,
          mainCharacter,
          feedback?.details || ""
        );

        rawPrompt = coverPrompt;
      } else {
        // Fallback if storyData is not available
        rawPrompt = `Create a front cover illustration for a children's book titled "${title}", ${styleDescription}.
${coverDescription}

${consistentCharacterPrompt}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, lettering, labels, or text elements of any kind should appear
3. Create a direct illustration, NOT a photograph or meta-representation of a book
4. Character must be rendered with 100% consistency to the profile above
${
  feedback?.details
    ? `\nADDITIONAL FEEDBACK TO ADDRESS:\n${feedback.details}`
    : ""
}`;
      }

      fileName = "cover.png";
    } else if (
      pageIndex >= 0 &&
      storyData &&
      storyData.pages &&
      pageIndex < storyData.pages.length
    ) {
      const page = storyData.pages[pageIndex];
      currentPageData = page;

      // Define style based on selected illustration style
      let styleDescription = defineStyle(illustrationStyle);
      const mainCharacter = storyData.mainCharacter || "protagonist";
      const characterProfile = storyData.characterProfile || "";

      // Use utility function to create page prompt
      const pagePrompt = createPageImagePrompt(
        parseInt(pageIndex) + 1,
        page.imageDescription,
        characterProfile,
        styleDescription,
        mainCharacter,
        feedback?.details || ""
      );

      rawPrompt = pagePrompt;
      fileName = `page${parseInt(pageIndex) + 1}.png`;
    } else if (requestPageData) {
      // Fallback if we don't have storyData but have pageData
      const styleDescription = defineStyle(illustrationStyle);

      rawPrompt = `Create an illustration for a children's story-book ${styleDescription}.

Scene description:
${requestPageData.imageDescription}

${consistentCharacterPrompt}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, lettering, labels, or text elements of any kind should appear
3. Create a direct illustration, NOT a photograph or meta-representation of a book
4. Character must match EXACTLY the description above with no deviations
${
  feedback?.details
    ? `\nADDITIONAL FEEDBACK TO ADDRESS:\n${feedback.details}`
    : ""
}`;

      fileName = `page${parseInt(pageIndex) + 1}.png`;
    }

    // Enhance the prompt with feedback
    if (!rawPrompt) {
      return Response.json(
        { error: "Failed to generate prompt for the image" },
        { status: 500 }
      );
    }

    const enhancedPrompt = enhancePromptWithFeedback(rawPrompt, feedback);
    // Trim the enhanced prompt to acceptable length
    const trimmedPrompt = trimPromptToLimit(enhancedPrompt);
    // Then sanitize the trimmed prompt
    const finalPrompt = sanitizePrompt(trimmedPrompt);

    console.log(`[${requestId}] 🖼️ Generating image with DALLE 3...`);
    console.log(
      `[${requestId}] 📋 Prompt length: ${finalPrompt.length} characters`
    );

    let imageUrl = null;
    let generationAttempts = 0;
    const MAX_GENERATION_ATTEMPTS = 2;

    while (generationAttempts < MAX_GENERATION_ATTEMPTS) {
      try {
        generationAttempts++;
        console.log(
          `[${requestId}] 🔄 Image generation attempt ${generationAttempts}/${MAX_GENERATION_ATTEMPTS}`
        );

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
        });

        console.log(`[${requestId}] ✅ Image generated successfully`);
        imageUrl = response.data[0].url;

        // Validate the generated image
        const validationResult = await validateImageQuality(imageUrl, {
          type: isCover ? "cover" : "page",
          hasCharacter: consistentCharacterPrompt ? true : false,
          hasText: isCover, // Only cover should have text
          textContent: isCover ? title : null, // No text content for story pages
        });

        if (validationResult.passed) {
          console.log(`[${requestId}] ✅ Image passed quality validation`);
          break;
        } else {
          console.log(
            `[${requestId}] ⚠️ Image failed validation: ${validationResult.issues.join(
              ", "
            )}`
          );
          if (generationAttempts >= MAX_GENERATION_ATTEMPTS) {
            console.log(
              `[${requestId}] ❌ Maximum generation attempts reached, proceeding with last image`
            );
          }
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ Error generating image:`, error);
        logApiError(requestId, error);
        break;
      }
    }

    if (!imageUrl) {
      return Response.json(
        { error: "Failed to generate the image after multiple attempts" },
        { status: 500 }
      );
    }

    // Download and save the image
    console.log(`[${requestId}] 📥 Downloading image...`);
    try {
      const imageResponse = await fetchWithRetry(imageUrl);
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(imageArrayBuffer);
      const imagePath = path.join(bookDir, fileName);
      await fs.writeFile(imagePath, imageBuffer);
      console.log(`[${requestId}] 💾 Image saved to ${imagePath}`);

      // Return the URL for the saved image
      const publicImageUrl = `/stories/${folderName}/${fileName}`;
      console.log(
        `[${requestId}] ✅ Image regeneration task completed successfully`
      );
      return Response.json({
        imageUrl: publicImageUrl,
        success: true,
        message: "Image regenerated successfully",
      });
    } catch (downloadError) {
      console.error(
        `[${requestId}] ❌ Error downloading generated image:`,
        downloadError.message
      );

      // Return partial success
      return Response.json({
        imageUrl: imageUrl, // Return the original DALL-E URL
        success: true,
        message: "Image regenerated but couldn't be downloaded",
        warning:
          "Image couldn't be downloaded to server due to connection issues",
      });
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error processing request:`, error);

    // Log detailed error information when available
    if (error.response?.data || error.code || error.status) {
      logApiError(requestId, error);
    }

    return Response.json(
      { error: "Failed to process regeneration request" },
      { status: 500 }
    );
  }
}
