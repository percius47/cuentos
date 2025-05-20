import { NextResponse } from "next/server";
import OpenAI from "openai";
import { uploadToS3, generateS3Key } from "@/app/utils/s3Client";
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
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] 🚀 Image regeneration process started`);

  try {
    const requestData = await request.json();
    const {
      storyId,
      pageIndex,
      feedback,
      title,
      coverDescription,
      pageData,
      illustrationStyle,
    } = requestData;

    // Validate required inputs
    if (!storyId || pageIndex === undefined) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Create a unique folder name for this story
    const folderName = title
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();

    // Define style based on selected illustration style
    let styleDescription = "";
    switch (illustrationStyle) {
      case "pixar-style":
        styleDescription =
          "in Pixar 3D animation style, with vibrant colors and detailed textures";
        break;
      case "disney-classic":
        styleDescription =
          "in classic Disney animation style, with fluid lines and warm colors";
        break;
      case "hand-drawn-watercolor":
        styleDescription =
          "in hand-drawn watercolor style, with soft brush strokes and translucent colors";
        break;
      case "cartoon-sketch":
        styleDescription =
          "in cartoon sketch style, with bold outlines and flat colors";
        break;
      case "minimalist-modern":
        styleDescription =
          "in minimalist modern style, with simple geometric shapes and solid colors";
        break;
      default:
        styleDescription =
          "in a colorful and child-friendly illustration style";
    }

    // Generate the image
    const isCover = pageIndex === "cover";
    const prompt = isCover
      ? `Create a cover illustration for a children's story-book ${styleDescription}.

Title: ${title}
Description: ${coverDescription}

Additional feedback: ${feedback}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, letters, labels, or text elements of any kind
3. Create a direct illustration of the scene described above`
      : `Create an illustration for page ${
          pageIndex + 1
        } of a children's story-book ${styleDescription}.

Scene description:
${pageData.imageDescription}

Additional feedback: ${feedback}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, letters, labels, or text elements of any kind
3. Create a direct illustration of the scene described above`;

    console.log(`[${requestId}] 🖌️ Generating new image...`);

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const imageUrl = imageResponse.data[0].url;

    // Download the image
    const imageFetchResponse = await fetch(imageUrl);
    const imageBuffer = await imageFetchResponse.arrayBuffer();

    // Upload to S3
    const imageKey = generateS3Key(
      `stories/${folderName}`,
      isCover ? "cover.png" : `page${pageIndex + 1}.png`
    );
    const imageS3Url = await uploadToS3(
      Buffer.from(imageBuffer),
      imageKey,
      "image/png"
    );

    console.log(`[${requestId}] ✅ New image generated and uploaded to S3`);

    return NextResponse.json({
      success: true,
      imageUrl: imageS3Url,
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    return NextResponse.json(
      {
        error: "Failed to regenerate image",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
