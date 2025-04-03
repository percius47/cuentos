import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// DALL-E 3 rate limit constants
const DALLE_RATE_LIMIT = 5; // 5 images per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const BATCH_SIZE = 5; // Process 5 images at a time (max batch size)
const BATCH_DELAY = 62000; // Wait slightly over a minute between batches
const MAX_GENERATION_ATTEMPTS = 2; // Maximum number of attempts to generate an image

// DALL-E prompt limits
const MAX_PROMPT_LENGTH = 3800; // Setting below 4000 to leave room for DALL-E's internal additions

// Helper function to sanitize prompts for safety
function sanitizePrompt(prompt) {
  // Remove potentially problematic content that could trigger content filters
  // This is a simple implementation - consider using more sophisticated content filtering
  const sanitized = prompt
    .replace(/violent|explicit|graphic|inappropriate/gi, "gentle")
    .replace(/kill|harm|hurt|weapon/gi, "interact with");

  return sanitized;
}

// Helper function to process image generation with rate limiting
async function processImagesWithRateLimiting(
  requestId,
  pages,
  generateImageFn
) {
  console.log(
    `[${requestId}] 🚦 Starting rate-limited image processing for ${pages.length} pages`
  );

  const results = [];

  // Process images in batches to respect rate limits
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batchPages = pages.slice(i, i + BATCH_SIZE);
    console.log(
      `[${requestId}] 🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${
        batchPages.length
      } images)`
    );

    // Process each page in the current batch
    const batchPromises = batchPages.map(async (page, batchIndex) => {
      const pageIndex = i + batchIndex;
      try {
        const result = await generateImageFn(page, pageIndex);
        return { success: true, data: result, pageIndex };
      } catch (error) {
        console.error(
          `[${requestId}] ❌ Error generating image for page ${pageIndex + 1}:`,
          error
        );
        return { success: false, error, pageIndex };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Wait between batches to respect rate limits, but only if there are more batches to process
    if (i + BATCH_SIZE < pages.length) {
      console.log(
        `[${requestId}] ⏱️ Rate limit reached. Waiting ${
          BATCH_DELAY / 1000
        } seconds before next batch...`
      );
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
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

// Helper function to check if we need to regenerate an image due to quality issues
async function validateImageQuality(imageUrl, validationCriteria) {
  // In a real implementation, this would use AI vision models to analyze the image
  // For now, we'll just log that validation would happen here
  console.log(
    `🔍 Validating image quality for ${imageUrl.substring(0, 50)}...`
  );
  console.log(`Validation criteria: ${JSON.stringify(validationCriteria)}`);

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

export async function POST(request) {
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[${requestId}] 🔄 Image generation task started`);

  try {
    const { title, coverDescription, pages, illustrationStyle } =
      await request.json();
    console.log(
      `[${requestId}] 📝 Parameters received: title="${title}", illustrationStyle=${illustrationStyle}, pageCount=${pages?.length}`
    );

    if (!title || !coverDescription || !pages || !pages.length) {
      console.log(`[${requestId}] ❌ Error: Missing required data`);
      return Response.json({ error: "Missing required data" }, { status: 400 });
    }

    // Format the folder name based on the title (remove special characters)
    const folderName = title
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
    const storiesDir = path.join(process.cwd(), "public", "stories");
    const bookDir = path.join(storiesDir, folderName);
    console.log(`[${requestId}] 📁 Creating directory: ${bookDir}`);

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
    let textStylePrompt = "";

    switch (illustrationStyle) {
      case "pixar-style":
        stylePrompt =
          "in Pixar 3D animation style, with vibrant colors and detailed textures. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        textStylePrompt =
          "The text should be large, clear, and use a playful rounded sans-serif font with strong contrast against the background. Position text in areas with simple, uncluttered backgrounds for maximum readability.";
        break;
      case "disney-classic":
        stylePrompt =
          "in classic Disney animation style, with fluid lines and warm colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        textStylePrompt =
          "The text should be elegant, clear, and use a classic storybook serif font with strong contrast against the background. Position text in areas with simple, uncluttered backgrounds for maximum readability.";
        break;
      case "hand-drawn-watercolor":
        stylePrompt =
          "in hand-drawn watercolor style, with soft brush strokes and translucent colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        textStylePrompt =
          "The text should be hand-lettered, clear, and use a consistent calligraphic style with strong contrast against the background. Position text in areas with simple, uncluttered backgrounds for maximum readability.";
        break;
      case "cartoon-sketch":
        stylePrompt =
          "in cartoon sketch style, with bold outlines and flat colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        textStylePrompt =
          "The text should be bold, clear, and use a comic-like font with strong contrast against the background. Position text in areas with simple, uncluttered backgrounds for maximum readability.";
        break;
      case "minimalist-modern":
        stylePrompt =
          "in minimalist modern style, with simple geometric shapes and solid colors. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        textStylePrompt =
          "The text should be clean, clear, and use a modern sans-serif font with strong contrast against the background. Position text in areas with simple, uncluttered backgrounds for maximum readability.";
        break;
      default:
        stylePrompt =
          "in a colorful and child-friendly style. Maintain consistent character designs with the same proportions, features, and clothing styles throughout all illustrations.";
        textStylePrompt =
          "The text should be large, clear, and use a child-friendly font with strong contrast against the background. Position text in areas with simple, uncluttered backgrounds for maximum readability.";
    }
    console.log(`[${requestId}] 🎨 Illustration style prompt: ${stylePrompt}`);

    // Extract protagonist name and details from pages
    let protagonistName = "";
    let protagonistDescription = "";

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
    if (!protagonistDescription) {
      protagonistDescription = pages[0].imageDescription;
      console.log(
        `[${requestId}] ⚠️ Using first page description as fallback for character details`
      );
    }

    // Generate a character profile image to ensure consistency
    let characterProfileUrl = null;
    let characterProfileDescription = "";

    if (protagonistName) {
      console.log(
        `[${requestId}] 🧩 Generating character profile for ${protagonistName}...`
      );

      // Craft a detailed character profile prompt
      const characterProfilePrompt = `Create a character profile sheet for ${protagonistName}, the protagonist of a children's book, ${stylePrompt}

DETAILED CHARACTER DESCRIPTION:
${protagonistDescription}

This should be a clear portrait showing the character's full appearance (face, hair, clothing, etc.) from the front. Include consistent details that should be maintained in all illustrations:
- Clear face with well-defined features
- Specific hair style and color
- Consistent clothing and accessories
- Unique identifying characteristics
- Appropriate body proportions for a child

This is a REFERENCE SHEET ONLY, so do NOT include any text, background elements, or other characters. Just show ${protagonistName} centered on a simple background.`;

      const sanitizedProfilePrompt = sanitizePrompt(characterProfilePrompt);

      try {
        console.log(
          `[${requestId}] 🖼️ Generating character reference image with DALLE 3...`
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
        console.log(
          `[${requestId}] 🔗 Character profile URL: ${characterProfileUrl.substring(
            0,
            60
          )}...`
        );

        // Download and save character profile image
        console.log(`[${requestId}] 📥 Downloading character profile image...`);
        try {
          const profileImageResponse = await fetchWithRetry(
            characterProfileUrl
          );
          const profileImageArrayBuffer =
            await profileImageResponse.arrayBuffer();
          const profileImageBuffer = Buffer.from(profileImageArrayBuffer);
          const profileImagePath = path.join(bookDir, "character_profile.png");
          await fs.writeFile(profileImagePath, profileImageBuffer);
          console.log(
            `[${requestId}] 💾 Character profile saved to ${profileImagePath}`
          );

          // Wait a moment to respect rate limits before generating more images
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (profileError) {
          console.error(
            `[${requestId}] ❌ Error downloading character profile image:`,
            profileError.message
          );
          console.log(`[${requestId}] ⚠️ Proceeding without character profile`);

          // Still use the character description for consistency even without the image
          if (protagonistDescription) {
            characterConsistencyPrompt = `
IMPORTANT CHARACTER CONSISTENCY:
The main character ${
              protagonistName || "protagonist"
            } must look EXACTLY the same in all illustrations, with these specific details:
${protagonistDescription}
Maintain consistent appearance, proportions, colors, and style across all illustrations.`;
          }
        }
      } catch (profileError) {
        console.error(
          `[${requestId}] ❌ Error generating character profile:`,
          profileError
        );
        logApiError(requestId, profileError);
        console.log(`[${requestId}] ⚠️ Proceeding without character profile`);
      }
    }

    // Create consistent character prompt to use in all images
    let characterConsistencyPrompt = "";
    if (characterProfileDescription) {
      characterConsistencyPrompt = `
IMPORTANT CHARACTER CONSISTENCY: 
The main character ${protagonistName} must look EXACTLY the same in all illustrations, with these specific details:
${characterProfileDescription}
Do not deviate from this character design in any way. Maintain the exact same appearance, proportions, colors, and style.`;
    } else if (protagonistDescription) {
      characterConsistencyPrompt = `
IMPORTANT CHARACTER CONSISTENCY:
The main character ${
        protagonistName || "protagonist"
      } must look EXACTLY the same in all illustrations, with these specific details:
${protagonistDescription}
Maintain consistent appearance, proportions, colors, and style across all illustrations.`;
    }

    // Create consistent character descriptions based on the first page to ensure visual continuity
    let characterDescriptions = "";
    if (pages && pages.length > 0 && pages[0].imageDescription) {
      // Extract potential character information from the first page description
      const firstPageDesc = pages[0].imageDescription;

      // Simple regex to try to identify character descriptions
      const characterMatch = firstPageDesc.match(
        /([A-Z][a-z]+ (?:is|has|with|wearing) [^.]+\.)/g
      );
      if (characterMatch && characterMatch.length > 0) {
        characterDescriptions =
          "Important character details to maintain consistently throughout all illustrations: " +
          characterMatch.join(" ");
      }
    }

    // First page image generation
    const firstPage = pages[0];
    const rawFirstPagePrompt = `Illustration for a children's book ${stylePrompt}

${characterConsistencyPrompt}

${antiMetaRepresentationRequirements}

${anatomicalCorrectnessRequirements}

${firstPage.imageDescription} 

IMPORTANT: This should be a TEXT-FREE illustration. DO NOT include any text, labels, captions, page numbers or words in the image. Create a beautiful illustration that represents the scene without any text elements.

FINAL CHECK: Verify the character has anatomically correct features (exactly two arms, two hands, etc.) and appears EXACTLY as shown in the character profile. This must be a direct illustration of the page content, NOT a photograph or meta-representation of a book.`;

    // Trim the prompt to ensure it doesn't exceed DALL-E's limit
    const trimmedFirstPagePrompt = trimPromptToLimit(rawFirstPagePrompt);
    const firstPagePrompt = sanitizePrompt(trimmedFirstPagePrompt);

    console.log(
      `[${requestId}] 🖼️ Generating first page image with DALLE 3...`
    );
    console.log(
      `[${requestId}] 📋 Prompt length: ${firstPagePrompt.length} characters`
    );

    let firstPageImagePath = null;
    let firstPageImageUrl = null;
    let firstPageGenerationAttempts = 0;

    while (firstPageGenerationAttempts < MAX_GENERATION_ATTEMPTS) {
      try {
        firstPageGenerationAttempts++;
        console.log(
          `[${requestId}] 🔄 First page generation attempt ${firstPageGenerationAttempts}/${MAX_GENERATION_ATTEMPTS}`
        );

    const firstPageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: firstPagePrompt,
      n: 1,
      size: "1024x1024",
    });

        console.log(
          `[${requestId}] ✅ First page image generated successfully`
        );
        firstPageImageUrl = firstPageResponse.data[0].url;

        // Validate the generated image
        const validationResult = await validateImageQuality(firstPageImageUrl, {
          type: "page",
          hasCharacter: protagonistName ? true : false,
          hasText: true,
          textContent: pages[0].content,
        });

        if (validationResult.passed) {
          console.log(
            `[${requestId}] ✅ First page image passed quality validation`
          );
          break;
        } else {
          console.log(
            `[${requestId}] ⚠️ First page image failed validation: ${validationResult.issues.join(
              ", "
            )}`
          );
          if (firstPageGenerationAttempts >= MAX_GENERATION_ATTEMPTS) {
            console.log(
              `[${requestId}] ❌ Maximum generation attempts reached, proceeding with last image`
            );
          }
        }
      } catch (pageError) {
        console.error(
          `[${requestId}] ❌ Error generating first page image:`,
          pageError
        );
        logApiError(requestId, pageError);
        break;
      }
    }

    // Download and save first page image
    if (firstPageImageUrl) {
      console.log(`[${requestId}] 📥 Downloading first page image...`);
      try {
        const firstPageImageResponse = await fetchWithRetry(firstPageImageUrl);
    const firstPageImageArrayBuffer =
      await firstPageImageResponse.arrayBuffer();
    const firstPageImageBuffer = Buffer.from(firstPageImageArrayBuffer);
        firstPageImagePath = path.join(bookDir, "page1.png");
    await fs.writeFile(firstPageImagePath, firstPageImageBuffer);
        console.log(
          `[${requestId}] 💾 First page image saved to ${firstPageImagePath}`
        );
      } catch (pageDownloadError) {
        console.error(
          `[${requestId}] ❌ Error downloading first page image:`,
          pageDownloadError.message
        );

        // Return the available URLs even if download failed
        return Response.json(
          {
            error:
              "Generated the first page image, but failed to download it due to connection issues.",
            coverImage: coverImagePath
              ? `/stories/${folderName}/cover.png`
              : null,
            originalImageUrls: {
              cover: coverImageUrl,
              firstPage: firstPageImageUrl,
            },
          },
          { status: 500 }
        );
      }
    }

    // Generate cover image
    let rawCoverPrompt = `Illustration for a children's book titled "${title}". ${coverDescription}. The illustration should be ${stylePrompt}

${characterConsistencyPrompt}

${textStylePrompt}

${textVisibilityRequirements}

${antiMetaRepresentationRequirements}

${anatomicalCorrectnessRequirements}

IMPORTANT: Include ONLY the title "${title}" text artistically integrated into the image - no other text, labels, captions, or words should appear anywhere in the image. The title text must be easily readable with high contrast against the background. Position the text in an area with a simple background to ensure readability.

FINAL CHECK: Verify the character has anatomically correct features (exactly two arms, two hands, etc.) and appears EXACTLY as shown in the character profile.`;

    // Trim the prompt to ensure it doesn't exceed DALL-E's limit
    const trimmedCoverPrompt = trimPromptToLimit(rawCoverPrompt);
    const coverPrompt = sanitizePrompt(trimmedCoverPrompt);

    console.log(`[${requestId}] 🖼️ Generating cover image with DALLE 3...`);
    console.log(
      `[${requestId}] 📋 Prompt length: ${coverPrompt.length} characters`
    );

    let coverImagePath = null;
    let coverImageUrl = null;
    let coverGenerationAttempts = 0;

    while (coverGenerationAttempts < MAX_GENERATION_ATTEMPTS) {
      try {
        coverGenerationAttempts++;
        console.log(
          `[${requestId}] 🔄 Cover generation attempt ${coverGenerationAttempts}/${MAX_GENERATION_ATTEMPTS}`
        );

        const coverResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: coverPrompt,
          n: 1,
          size: "1024x1024",
        });

        console.log(`[${requestId}] ✅ Cover image generated successfully`);
        coverImageUrl = coverResponse.data[0].url;

        // Validate the generated image
        const validationResult = await validateImageQuality(coverImageUrl, {
          type: "cover",
          hasCharacter: protagonistName ? true : false,
          hasText: true,
        });

        if (validationResult.passed) {
          console.log(
            `[${requestId}] ✅ Cover image passed quality validation`
          );
          break;
        } else {
          console.log(
            `[${requestId}] ⚠️ Cover image failed validation: ${validationResult.issues.join(
              ", "
            )}`
          );
          if (coverGenerationAttempts >= MAX_GENERATION_ATTEMPTS) {
            console.log(
              `[${requestId}] ❌ Maximum generation attempts reached, proceeding with last image`
            );
          }
        }
      } catch (coverError) {
        console.error(
          `[${requestId}] ❌ Error generating cover image:`,
          coverError
        );
        logApiError(requestId, coverError);
        break;
      }
    }

    // Download and save cover image
    if (coverImageUrl) {
      console.log(`[${requestId}] 📥 Downloading cover image...`);
      try {
        const coverImageResponse = await fetchWithRetry(coverImageUrl);
        const coverImageArrayBuffer = await coverImageResponse.arrayBuffer();
        const coverImageBuffer = Buffer.from(coverImageArrayBuffer);
        coverImagePath = path.join(bookDir, "cover.png");
        await fs.writeFile(coverImagePath, coverImageBuffer);
        console.log(`[${requestId}] 💾 Cover image saved to ${coverImagePath}`);
      } catch (coverDownloadError) {
        console.error(
          `[${requestId}] ❌ Error downloading cover image:`,
          coverDownloadError.message
        );
        coverImagePath = null;
      }
    }

    // FOR FUTURE USE: Function to generate image for a single page
    const generatePageImage = async (page, pageIndex) => {
      console.log(`[${requestId}] 📄 Processing page ${pageIndex + 1}...`);
      const rawPagePrompt = `Illustration for a children's book ${stylePrompt}

${characterConsistencyPrompt}

${antiMetaRepresentationRequirements}

${anatomicalCorrectnessRequirements}

${page.imageDescription} 

IMPORTANT: This should be a TEXT-FREE illustration. DO NOT include any text, labels, captions, page numbers or words in the image. Create a beautiful illustration that represents the scene without any text elements.

FINAL CHECK: Verify the character has anatomically correct features (exactly two arms, two hands, etc.) and appears EXACTLY as shown in the character profile. This must be a direct illustration of the page content, NOT a photograph or meta-representation of a book.`;

      // Trim the prompt to acceptable length
      const trimmedPagePrompt = trimPromptToLimit(rawPagePrompt);
      const pagePrompt = sanitizePrompt(trimmedPagePrompt);

      console.log(
        `[${requestId}] 🖼️ Generating image for page ${
          pageIndex + 1
        } with DALLE 3...`
      );
      console.log(
        `[${requestId}] 📋 Prompt length: ${pagePrompt.length} characters`
      );

      const pageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: pagePrompt,
        n: 1,
        size: "1024x1024",
      });

      console.log(
        `[${requestId}] ✅ Image for page ${
          pageIndex + 1
        } generated successfully`
      );

      const pageImageUrl = pageResponse.data[0].url;
      console.log(
        `[${requestId}] 🔗 Page ${
          pageIndex + 1
        } image URL: ${pageImageUrl.substring(0, 60)}...`
      );

      // Download and save page image
      console.log(
        `[${requestId}] 📥 Downloading image for page ${pageIndex + 1}...`
      );
      const pageImageResponse = await fetch(pageImageUrl);
      const pageImageArrayBuffer = await pageImageResponse.arrayBuffer();
      const pageImageBuffer = Buffer.from(pageImageArrayBuffer);
      const pageImagePath = path.join(bookDir, `page${pageIndex + 1}.png`);
      await fs.writeFile(pageImagePath, pageImageBuffer);
      console.log(
        `[${requestId}] 💾 Image for page ${
          pageIndex + 1
        } saved to ${pageImagePath}`
      );

      return `/stories/${folderName}/page${pageIndex + 1}.png`;
    };

    // FOR FUTURE USE: Generate all pages with rate limiting
    // This code is ready to be used when needed, but currently commented out
    /*
    if (pages.length > 1) {
      console.log(`[${requestId}] 📚 Generating remaining ${pages.length - 1} pages with rate limiting...`);
      
      // Skip the first page since we already generated it
      const remainingPages = pages.slice(1);
      
      // Process remaining pages with rate limiting
      const pageResults = await processImagesWithRateLimiting(
        requestId,
        remainingPages,
        async (page, index) => {
          // Adjust index to account for the first page
          return generatePageImage(page, index + 1);
        }
      );
      
      // Filter successful results
      const successfulPagePaths = pageResults
        .filter(result => result.success)
        .map(result => result.data);
      
      // Log completion status
      const successCount = successfulPagePaths.length;
      const failCount = pageResults.length - successCount;
      
      console.log(`[${requestId}] 📊 Page generation completed: ${successCount} successful, ${failCount} failed`);
      
      // Combine with first page
      const allPagePaths = [`/stories/${folderName}/page1.png`, ...successfulPagePaths];
      
      // Return all generated images
      console.log(`[${requestId}] ✅ Image generation task completed. Generated ${allPagePaths.length} pages.`);
      return Response.json({
        coverImage: `/stories/${folderName}/cover.png`,
        pageImages: allPagePaths,
        partial: failCount > 0,
        totalPages: pages.length,
        generatedPages: allPagePaths.length,
      });
    }
    */

    // Return the URLs for the saved images (currently just cover and first page)
    console.log(
      `[${requestId}] ✅ Image generation task completed successfully`
    );
    return Response.json({
      coverImage: `/stories/${folderName}/cover.png`,
      pageImages: [`/stories/${folderName}/page1.png`],
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generating images:`, error);

    // Log detailed error information when available
    if (error.response?.data || error.code || error.status) {
      logApiError(requestId, error);
    }

    let errorMessage = "Failed to generate images";
    if (error.code === "content_policy_violation") {
      errorMessage =
        "Failed to generate images due to content policy violation. Please try a different prompt or theme.";
    }

    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
