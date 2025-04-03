import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

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

// Helper function to log API errors
function logApiError(requestId, error) {
  console.error(`[${requestId}] 🔴 API Error:`, error.message);

  if (error.response) {
    console.error(`[${requestId}] Status: ${error.response.status}`);
    console.error(
      `[${requestId}] Data: ${JSON.stringify(error.response.data)}`
    );
  }
}

// Helper function to fetch with retry
async function fetchWithRetry(url, options = {}, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Fetch attempt ${attempt}/${maxRetries} for ${url.substring(0, 50)}...`
      );
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      lastError = error;

      if (attempt < maxRetries) {
        console.log(`Waiting ${delay / 1000} seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Exponential backoff
        delay *= 2;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
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
  // 1. Character features and proportions
  // 2. No text accidentally included
  // 3. Character is properly centered and visible
  // 4. Anatomical correctness

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
    "CRITICAL REQUIREMENTS",
    "DETAILED CHARACTER",
    "PURPOSE:",
    "REFERENCE",
    "This is a REFERENCE SHEET",
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

export async function POST(request) {
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[${requestId}] 🧩 Character profile generation task started`);

  try {
    const {
      storyId,
      title,
      illustrationStyle,
      characterName,
      characterDescription,
      pages,
    } = await request.json();

    console.log(
      `[${requestId}] 📝 Parameters received: storyId=${storyId}, title="${title}", characterName="${characterName}"`
    );

    // Validate required data
    if (!storyId || !title || !illustrationStyle) {
      console.log(
        `[${requestId}] ❌ Error: Missing required data (storyId, title, or illustrationStyle)`
      );
      return Response.json({ error: "Missing required data" }, { status: 400 });
    }

    // Need either character information or pages data to extract it
    if (
      (!characterName || !characterDescription) &&
      (!pages || !pages.length)
    ) {
      console.log(
        `[${requestId}] ❌ Error: Missing either character details or pages data`
      );
      return Response.json(
        { error: "Missing character details or pages data" },
        { status: 400 }
      );
    }

    // Format the folder name based on the title (remove special characters)
    const folderName = title
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
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

    // Define style prompts based on user selection
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

    // Extract protagonist name and details from pages if not provided
    let protagonistName = characterName || "";
    let protagonistDescription = characterDescription || "";

    // If character details aren't provided, analyze pages to find them
    if ((!protagonistName || !protagonistDescription) && pages) {
      console.log(
        `[${requestId}] 🔍 Extracting character details from pages...`
      );

      // Analyze all pages to find the protagonist's name and description
      for (const page of pages) {
        if (page.imageDescription) {
          // Look for common protagonist introduction patterns
          const nameMatches = page.imageDescription.match(
            /([A-Z][a-z]+)(?:\s+is|\s+was|\s+the\s+(?:boy|girl|child|protagonist|main\s+character))/
          );
          if (nameMatches && nameMatches[1]) {
            protagonistName = nameMatches[1];
            console.log(
              `[${requestId}] 🔍 Found protagonist name: ${protagonistName}`
            );

            // Once we have a name, try to find a description associated with it
            const descRegex = new RegExp(
              `${protagonistName}\\s+(?:is|was|has|with|wearing)\\s+[^.]+\\.`,
              "g"
            );
            const descMatches = page.imageDescription.match(descRegex);

            if (descMatches && descMatches.length > 0) {
              protagonistDescription = descMatches.join(" ");
              console.log(
                `[${requestId}] 🔍 Found protagonist description: ${protagonistDescription}`
              );
              break; // Found what we need
            }
          }
        }
      }

      // If we couldn't find a good description, analyze content text as well
      if (!protagonistDescription && protagonistName) {
        for (const page of pages) {
          if (page.content) {
            const descRegex = new RegExp(
              `${protagonistName}\\s+(?:is|was|has|with|wearing)\\s+[^.]+\\.`,
              "g"
            );
            const descMatches = page.content.match(descRegex);

            if (descMatches && descMatches.length > 0) {
              protagonistDescription = descMatches.join(" ");
              console.log(
                `[${requestId}] 🔍 Found protagonist description in content: ${protagonistDescription}`
              );
              break;
            }
          }
        }
      }

      // If we still don't have details, use the first page description
      if (!protagonistDescription && pages.length > 0) {
        protagonistDescription = pages[0].imageDescription;
        console.log(
          `[${requestId}] ⚠️ Using first page description as fallback for character details`
        );
      }
    }

    // Verify we have the necessary data to generate the character profile
    if (!protagonistName) {
      console.log(
        `[${requestId}] ⚠️ No protagonist name found, using "protagonist" as default`
      );
      protagonistName = "the protagonist";
    }

    if (!protagonistDescription) {
      console.log(`[${requestId}] ❌ Error: No character description found`);
      return Response.json(
        { error: "Could not determine character description" },
        { status: 400 }
      );
    }

    // Generate character profile image
    console.log(
      `[${requestId}] 🧩 Generating character profile for ${protagonistName}...`
    );

    // Craft a detailed character profile prompt
    const characterProfilePrompt = `Create a character profile sheet for ${protagonistName}, the protagonist of a children's book, ${stylePrompt}

DETAILED CHARACTER DESCRIPTION:
${protagonistDescription}

CRITICAL REQUIREMENTS:
- This must be a FLAT ILLUSTRATION, NOT a photograph
- Create a DIRECT FRONT-FACING view of the character (head-to-toe)
- Show the COMPLETE character with anatomically correct proportions (exactly two arms, two legs)
- Include clear, distinct facial features that can be easily replicated
- Ensure hair style and color are highly distinctive and memorable
- Show detailed clothing with specific colors and patterns
- Character should be posed naturally with a neutral background

This is a REFERENCE SHEET ONLY, so do NOT include:
- NO text, labels, captions, or words anywhere
- NO background elements, scenes, or other characters
- NO book frames, pages, spines, or meta-representations
- NO photographic angles, lighting effects, or camera artifacts

PURPOSE: This reference image will be used to ensure the character appears EXACTLY the same in all subsequent illustrations. All details must be clear and easy to reproduce consistently.`;

    // Trim the prompt to ensure it doesn't exceed DALL-E's limit
    const trimmedProfilePrompt = trimPromptToLimit(characterProfilePrompt);
    const sanitizedProfilePrompt = sanitizePrompt(trimmedProfilePrompt);

    console.log(
      `[${requestId}] 🖼️ Generating character reference image with DALLE 3...`
    );
    console.log(
      `[${requestId}] 📋 Prompt length: ${sanitizedProfilePrompt.length} characters`
    );

    let characterProfileUrl = null;
    let characterProfileDescription = null;
    let generationAttempts = 0;
    const MAX_GENERATION_ATTEMPTS = 2;

    while (generationAttempts < MAX_GENERATION_ATTEMPTS) {
      try {
        generationAttempts++;
        console.log(
          `[${requestId}] 🔄 Character profile generation attempt ${generationAttempts}/${MAX_GENERATION_ATTEMPTS}`
        );

        const characterProfileResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: sanitizedProfilePrompt,
          n: 1,
          size: "1024x1024",
        });

        characterProfileUrl = characterProfileResponse.data[0].url;
        // Save the revised prompt from DALL-E for consistency
        characterProfileDescription =
          characterProfileResponse.data[0].revised_prompt ||
          sanitizedProfilePrompt;

        console.log(
          `[${requestId}] ✅ Character profile image generated successfully`
        );

        // Validate the generated image
        const validationResult = await validateImageQuality(
          characterProfileUrl,
          {
            type: "character_profile",
            characterName: protagonistName,
          }
        );

        if (validationResult.passed) {
          console.log(
            `[${requestId}] ✅ Character profile passed quality validation`
          );
          break;
        } else {
          console.log(
            `[${requestId}] ⚠️ Character profile failed validation: ${validationResult.issues.join(
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
        console.error(
          `[${requestId}] ❌ Error generating character profile:`,
          error
        );
        logApiError(requestId, error);
        break;
      }
    }

    if (!characterProfileUrl) {
      return Response.json(
        {
          error: "Failed to generate character profile after multiple attempts",
          details:
            "The AI model could not create a suitable character profile. Please try again with more detailed description.",
        },
        { status: 500 }
      );
    }

    // Download and save character profile image
    console.log(`[${requestId}] 📥 Downloading character profile image...`);
    try {
      const profileImageResponse = await fetchWithRetry(characterProfileUrl);
      const profileImageArrayBuffer = await profileImageResponse.arrayBuffer();
      const profileImageBuffer = Buffer.from(profileImageArrayBuffer);
      const profileImagePath = path.join(bookDir, "character_profile.png");
      await fs.writeFile(profileImagePath, profileImageBuffer);
      console.log(
        `[${requestId}] 💾 Character profile saved to ${profileImagePath}`
      );

      return Response.json({
        success: true,
        message: "Character profile generated successfully",
        characterName: protagonistName,
        characterDescription: protagonistDescription,
        characterProfileUrl: `/stories/${folderName}/character_profile.png`,
        characterProfilePrompt: characterProfileDescription,
      });
    } catch (downloadError) {
      console.error(
        `[${requestId}] ❌ Error downloading character profile image:`,
        downloadError.message
      );

      // Return partial success - we have the URL but couldn't download it
      return Response.json({
        success: true,
        message: "Character profile generated but couldn't be downloaded",
        characterName: protagonistName,
        characterDescription: protagonistDescription,
        characterProfileUrl: characterProfileUrl, // Return the original URL instead
        characterProfilePrompt: characterProfileDescription,
        warning:
          "Image couldn't be downloaded to server due to connection issues",
      });
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Unexpected error:`, error);

    return Response.json(
      { error: "An unexpected error occurred", details: error.message },
      { status: 500 }
    );
  }
}
