import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
// fs and path are server-side only modules (won't work in the browser)
import fs from "fs";
import path from "path";

// Feature flags for testing/development
const FEATURE_FLAGS = {
  ENABLE_IMAGE_GENERATION: true, // Enable image generation to generate exactly 2 images
  USE_PLACEHOLDER_IMAGES: false, // Use real generation
  TEST_MODE: true, // Limit pages for testing
  PREVIEW_MODE: true, // Only show first 2 pages in preview mode
  LANGUAGE: "Spanish", // Default language
  SAVE_IMAGES_LOCALLY: true, // Save generated images locally for reuse
  MAX_STORY_PAGES: 1, // One cover + one story page
};

// Page configuration
const CONFIG = {
  DEFAULT_PAGE_COUNT: 1, // Default for full books (1 cover + 1 story page)
  PREVIEW_PAGE_COUNT: 1, // Number of pages in preview mode
  TEST_PAGE_COUNT: 1, // Number of pages in test mode
};

// Sample placeholder images that can be reused (replace with your actual placeholder URLs)
const PLACEHOLDER_IMAGES = {
  cover: "/images/sample/cover.png", // Local image path
  pages: [
    "/images/sample/page1.png", // Local image path
  ],
};

// Local paths for saving generated images
const LOCAL_IMAGE_PATHS = {
  directory: "./public/images/sample/",
  cover: "./public/images/sample/cover.png",
  page1: "./public/images/sample/page1.png",
};

// Initialize OpenAI client with simpler format
const openai = new OpenAI();

// Debug output for API key
console.log("API Key status:", {
  OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
  NEXT_PUBLIC_OPENAI_API_KEY_EXISTS: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

// Helper for logging API requests/responses
function logApiOperation(operation: string, data: any = null) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] === ${operation.toUpperCase()} ===`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Update the saveImageToDisk function to support story-specific folders
async function saveImageToDisk(
  imageUrl: string,
  localPath: string,
  storyTitle?: string
): Promise<string> {
  try {
    console.log(
      `Saving image from ${imageUrl.substring(0, 50)}... to ${localPath}`
    );

    // If a story title is provided, save to a story-specific folder
    if (storyTitle) {
      const folderName = storyTitle.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const storyFolder = path.join("./public/stories", folderName);

      // Create the folder if it doesn't exist
      if (!fs.existsSync("./public/stories")) {
        fs.mkdirSync("./public/stories", { recursive: true });
      }
      if (!fs.existsSync(storyFolder)) {
        fs.mkdirSync(storyFolder, { recursive: true });
      }

      // Determine file name (cover or page)
      const fileName = localPath.includes("cover")
        ? "cover.png"
        : `page_${localPath.includes("page1") ? "1" : "0"}.png`;
      localPath = path.join(storyFolder, fileName);
    }

    // Make sure directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write file
    fs.writeFileSync(localPath, buffer);
    console.log(`✅ Image saved successfully to ${localPath}`);

    // Return the path where the image was saved (relative to public)
    return localPath.replace("./public", "");
  } catch (error) {
    console.error("❌ Failed to save image:", error);
    return ""; // Return empty string on error
  }
}

export async function POST(request: NextRequest) {
  console.log("\n\n🚀 Starting new story generation request");
  console.log("------------------------------------------------");

  // Record start time
  const startTime = Date.now();

  try {
    const {
      childName,
      theme,
      style,
      age,
      language = FEATURE_FLAGS.LANGUAGE,
      customPrompt,
    } = await request.json();
    logApiOperation("Request parameters", {
      childName,
      theme,
      style,
      age,
      language,
      customPrompt,
    });

    if (!childName || !theme) {
      logApiOperation("Error", { message: "Missing required fields" });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Set language for generation
    const isSpanish = language.toLowerCase() === "spanish";

    // Get theme description
    const themeDescription = getThemeDescription(
      theme,
      customPrompt,
      isSpanish
    );
    const styleDescription = getStyleDescription(style, isSpanish);

    // Determine age-appropriate content
    const ageGroup = getAgeGroup(age);

    // Determine page count based on mode
    let pageCount = FEATURE_FLAGS.MAX_STORY_PAGES;
    console.log(
      `🔒 Limiting generation to ${pageCount} story page(s) + 1 cover to save API credits`
    );

    // STEP 1: Generate story content
    console.log("\n📝 STEP 1: Generating story content...");

    // Prepare prompt for GPT-4o
    const storyPrompt = isSpanish
      ? generateSpanishStoryPrompt(
          childName,
          themeDescription,
          pageCount,
          ageGroup
        )
      : generateEnglishStoryPrompt(
          childName,
          themeDescription,
          pageCount,
          ageGroup
        );

    logApiOperation("Story generation prompt", { prompt: storyPrompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: isSpanish
            ? "Eres un autor creativo de libros infantiles que crea historias atractivas y apropiadas para niños. Responde en formato JSON."
            : "You are a creative children's book author who creates engaging, age-appropriate stories. Respond in JSON format.",
        },
        { role: "user", content: storyPrompt },
      ],
      response_format: { type: "json_object" },
    });

    // Parse the response
    const content = response.choices[0]?.message?.content || "";
    logApiOperation("Story generation response", {
      content: content.substring(0, 300) + "...",
    });

    const storyData = JSON.parse(content);
    console.log(
      `✅ Story successfully generated: "${storyData.title}" with ${storyData.pages.length} pages`
    );

    // STEP 2: Generate character descriptions
    console.log(
      "\n👤 STEP 2: Creating character descriptions for consistent illustrations..."
    );

    const characterDescriptionPrompt = isSpanish
      ? generateSpanishCharacterPrompt(storyData, childName)
      : generateEnglishCharacterPrompt(storyData, childName);

    logApiOperation("Character description prompt", {
      prompt: characterDescriptionPrompt.substring(0, 300) + "...",
    });

    const characterDescriptionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at creating detailed and consistent character descriptions for illustrations. Provide your response in JSON format.",
        },
        {
          role: "user",
          content: characterDescriptionPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const characterDescriptionsContent =
      characterDescriptionResponse.choices[0]?.message?.content || "{}";
    logApiOperation("Character descriptions response", {
      content: characterDescriptionsContent.substring(0, 300) + "...",
    });

    let characterDescriptions: Record<string, string> = {};
    try {
      characterDescriptions = JSON.parse(characterDescriptionsContent);

      // Validate that characterDescriptions is actually an object
      if (
        typeof characterDescriptions !== "object" ||
        characterDescriptions === null ||
        Array.isArray(characterDescriptions)
      ) {
        console.error(
          "Character descriptions not in expected object format:",
          characterDescriptions
        );
        // Create a default object
        characterDescriptions = {
          [childName]: `The main character of the story. A child with an adventurous spirit.`,
        };
      }

      console.log(
        `✅ Character descriptions created for ${
          Object.keys(characterDescriptions).length
        } characters`
      );
    } catch (error) {
      console.error("Error parsing character descriptions:", error);
      // Create default character description if parsing fails
      characterDescriptions = {
        [childName]: `The main character of the story. A child with an adventurous spirit.`,
      };
      console.log(
        "✅ Created fallback character description for main character"
      );
    }

    // STEP 3: Generate image prompts (if needed)
    let allPrompts: string[] = [];
    if (
      !FEATURE_FLAGS.USE_PLACEHOLDER_IMAGES &&
      FEATURE_FLAGS.ENABLE_IMAGE_GENERATION
    ) {
      console.log("\n🖌️ STEP 3: Creating image prompts for each page...");

      // First, create a separate prompt for the cover image
      const coverImagePrompt = `Create a short, focused prompt (max 500 characters) for a cover image of a children's storybook titled "${
        storyData.title
      }" featuring ${childName} in ${styleDescription.split(".")[0]} style.

The cover image should:
1. Feature ${childName} prominently
2. Include the title "${storyData.title}"
3. Convey the story's theme
4. Be appropriate for a children's book

Format your response as a concise prompt for DALL-E.`;

      logApiOperation("Cover image prompt generation", {
        prompt: coverImagePrompt.substring(0, 300) + "...",
      });

      const coverPromptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at creating children's book cover designs.",
          },
          { role: "user", content: coverImagePrompt },
        ],
      });

      const coverPrompt =
        coverPromptResponse.choices[0]?.message?.content ||
        `A beautiful cover page for a children's storybook titled "${storyData.title}" featuring ${childName} as the main character in ${styleDescription} style. The title should be prominently displayed.`;

      console.log("✅ Cover image prompt generated");
      console.log(`Cover prompt: ${coverPrompt.substring(0, 100)}...`);

      // Then create the regular image prompts for story pages
      const imagePromptGenerationPrompt = `Create a short image generation prompt (max 500 characters each) for page ${pageCount} of this children's story. The illustrations should be in ${style} style.

Story title: ${storyData.title}
Main character: ${childName}

IMPORTANT: 
1. Create ONLY ONE concise prompt
2. Focus on the main scene from the page
3. Keep the prompt under 500 characters total
4. Maintain a child-appropriate, ${style} illustration style

Story page: ${storyData.pages[0].text}`;

      logApiOperation("Image prompts generation prompt", {
        prompt: imagePromptGenerationPrompt.substring(0, 300) + "...",
      });

      const imagePromptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert character designer and illustrator for children's books who creates detailed prompts for AI image generation. Your top priority is ABSOLUTE character consistency across all illustrations. 

Your prompts must maintain perfect character consistency by:
1. Starting EVERY prompt with the EXACT SAME detailed character description (word-for-word) 
2. Never varying any aspect of the character's appearance between pages
3. Treating the character like an animation model sheet where consistency is critical
4. Ensuring the character's age, hair, clothing, face, and body type remain identical in every illustration

Only the character's pose and actions should change between illustrations - never their appearance.

Think of this as creating a storyboard where the character model must remain visually identical from frame to frame.

Provide your response in JSON format.`,
          },
          {
            role: "user",
            content: imagePromptGenerationPrompt,
          },
        ],
        response_format: { type: "json_object" },
      });

      const imagePromptsContent =
        imagePromptResponse.choices[0]?.message?.content || "{}";
      logApiOperation("Image prompts response", {
        content: imagePromptsContent.substring(0, 300) + "...",
      });

      // Fix for image prompts parsing - handle different response formats
      let imagePrompts = [];
      try {
        const parsedContent = JSON.parse(imagePromptsContent);
        console.log(
          "Parsed GPT-4o image prompt response:",
          typeof parsedContent,
          Array.isArray(parsedContent)
        );

        // Check different possible formats that might be returned
        if (Array.isArray(parsedContent)) {
          // If response is already an array
          imagePrompts = parsedContent;
        } else if (
          parsedContent.prompts &&
          Array.isArray(parsedContent.prompts)
        ) {
          // If response has a 'prompts' property that's an array
          imagePrompts = parsedContent.prompts;
        } else if (typeof parsedContent === "object") {
          // If response is an object with numeric keys or page references
          imagePrompts = Object.values(parsedContent);
        } else {
          // Fallback with consistent character description
          const characterDesc =
            characterDescriptions[childName] ||
            `A child with an adventurous spirit, wearing comfortable clothes suitable for adventure.`;
          imagePrompts = storyData.pages.map(
            (page: any, i: number) =>
              `A children's book illustration in ${styleDescription} style. The main character is ${characterDesc}. Scene: ${page.text.substring(
                0,
                100
              )}`
          );
        }

        // Ensure all prompts are strings and start with consistent character description
        const characterDesc =
          characterDescriptions[childName] ||
          `A child with an adventurous spirit, wearing comfortable clothes suitable for adventure.`;

        imagePrompts = imagePrompts.map((prompt: any, index: number) => {
          let promptText =
            typeof prompt === "string"
              ? prompt
              : typeof prompt === "object" && prompt !== null
              ? prompt.text ||
                prompt.prompt ||
                prompt.description ||
                JSON.stringify(prompt)
              : `Generate a ${
                  styleDescription.split(".")[0]
                } illustration for page ${index + 1} of the story "${
                  storyData.title
                }" featuring ${childName}`;

          // Truncate to max 4000 characters
          if (promptText.length > 3900) {
            console.log(
              `⚠️ Truncating prompt from ${promptText.length} to 3900 characters`
            );
            promptText = promptText.substring(0, 3900);
          }

          return promptText;
        });
      } catch (error) {
        console.error("Error parsing image prompts:", error);
        // Create fallback prompts with simplified style
        imagePrompts = storyData.pages.map((page: any, i: number) =>
          `A simple ${style} illustration for a children's book. Scene: ${page.text.substring(
            0,
            150
          )}`.substring(0, 3900)
        );
      }

      // Combine cover prompt with page prompts
      allPrompts = [coverPrompt, ...imagePrompts];

      console.log(
        `✅ Generated 1 cover prompt and ${imagePrompts.length} page prompts`
      );

      // Log the actual prompts for debugging
      allPrompts.forEach((prompt: any, i: number) => {
        // Check if prompt is a string before calling substring
        const promptText =
          typeof prompt === "string"
            ? prompt.substring(0, 100) + "..."
            : JSON.stringify(prompt).substring(0, 100) + "...";
        console.log(
          `Prompt ${i} (${i === 0 ? "Cover" : "Page " + i}): ${promptText}`
        );
      });
    }

    // STEP 4: Generate images or use placeholders
    console.log("\n🖼️ STEP 4: Setting up illustrations for each page...");

    // Generate images with DALL-E or use placeholders if image generation is not available
    let imageUrls: string[] = [];
    let usedFallbackImages = false;

    if (FEATURE_FLAGS.USE_PLACEHOLDER_IMAGES) {
      console.log("🧪 Using placeholder images to save API credits");
      // Use predefined placeholder images
      imageUrls = [
        PLACEHOLDER_IMAGES.cover,
        ...PLACEHOLDER_IMAGES.pages.slice(0, pageCount),
      ];
      usedFallbackImages = true;
    } else if (!FEATURE_FLAGS.ENABLE_IMAGE_GENERATION) {
      console.log("🧪 Image generation is disabled for testing");
      // Generate placeholder images with style information
      imageUrls = [
        `https://placehold.co/1024x1024/9089fc/ffffff?text=Cover:+${storyData.title}`,
        ...storyData.pages.map(
          (_: any, index: number) =>
            `https://placehold.co/1024x1024/9089fc/ffffff?text=Page+${
              index + 1
            }:+${style}+Style`
        ),
      ];
      usedFallbackImages = true;
    } else {
      // Check if we have a valid API key before attempting DALL-E generation
      const hasValidApiKey =
        !!process.env.OPENAI_API_KEY ||
        !!process.env.NEXT_PUBLIC_OPENAI_API_KEY;

      if (!hasValidApiKey) {
        console.log("⚠️ Missing API key for image generation");
        imageUrls = [
          `https://placehold.co/1024x1024/FF8C42/ffffff?text=Cover:+${storyData.title}`,
          ...generatePlaceholderImages(storyData, style, childName),
        ];
        usedFallbackImages = true;
      } else {
        try {
          // Attempt to generate images with DALL-E
          const imagePromisesWithFallback = allPrompts.map(
            async (prompt: any, index: number) => {
              // Skip if beyond our limit (cover + 1 page)
              if (index > FEATURE_FLAGS.MAX_STORY_PAGES) {
                return `https://placehold.co/1024x1024/EEE/999?text=Page+${index}:+Limited`;
              }

              const promptString =
                typeof prompt === "string"
                  ? prompt.substring(0, 3900) // Ensure prompt is under 4000 chars
                  : typeof prompt === "object" && prompt !== null
                  ? JSON.stringify(prompt).substring(0, 3900)
                  : index === 0
                  ? `Cover image for "${
                      storyData.title
                    }" featuring ${childName} in ${
                      styleDescription.split(".")[0]
                    } style.`.substring(0, 3900)
                  : `Generate a ${
                      styleDescription.split(".")[0]
                    } illustration for a children's story featuring ${childName}`.substring(
                      0,
                      3900
                    );

              console.log(
                `Image prompt length: ${promptString.length} characters`
              );

              console.log(
                `Generating image ${index}/${Math.min(
                  allPrompts.length,
                  FEATURE_FLAGS.MAX_STORY_PAGES + 1
                )} ${index === 0 ? "(Cover)" : "(Page " + index + ")"}`
              );

              try {
                console.log(
                  `Image prompt: ${promptString.substring(0, 100)}...`
                );
                const response = await openai.images.generate({
                  model: "dall-e-3",
                  prompt: promptString,
                  n: 1,
                  size: "1024x1024",
                });

                if (!response.data || response.data.length === 0) {
                  throw new Error("Empty response data from DALL-E");
                }

                const imageUrl = response.data[0]?.url;
                if (!imageUrl) {
                  throw new Error("No image URL in DALL-E response");
                }

                console.log(
                  `✅ Generated image ${index}/${Math.min(
                    allPrompts.length,
                    FEATURE_FLAGS.MAX_STORY_PAGES + 1
                  )}`
                );

                // Save image locally if enabled
                if (FEATURE_FLAGS.SAVE_IMAGES_LOCALLY) {
                  try {
                    const localPath =
                      index === 0
                        ? LOCAL_IMAGE_PATHS.cover
                        : LOCAL_IMAGE_PATHS.page1;
                    // Also save to story-specific folder
                    const savedPath = await saveImageToDisk(
                      imageUrl,
                      localPath,
                      storyData.title
                    );

                    // Replace original URL with local path for future use if saved successfully
                    if (savedPath) {
                      console.log(
                        `For future use, you can reference this image at: ${savedPath}`
                      );
                      // We'll keep the original URL for now, but note the local path
                      // Later we'll update the URLs in the final response
                    }
                  } catch (saveError) {
                    console.error("Error saving image locally:", saveError);
                  }
                }

                return imageUrl;
              } catch (error: any) {
                console.error(
                  `❌ Failed to generate image ${index}/${Math.min(
                    allPrompts.length,
                    FEATURE_FLAGS.MAX_STORY_PAGES + 1
                  )}:`,
                  error
                );

                // Determine error type and code
                let errorType = "UNKNOWN_ERROR";
                let errorMessage = error.message || "Unknown error";

                if (error.response) {
                  const statusCode = error.response.status;
                  errorType = `API_ERROR_${statusCode}`;

                  // Handle specific API errors
                  if (statusCode === 400) {
                    errorType = "CONTENT_POLICY_VIOLATION";
                    errorMessage =
                      "The image generation request was rejected due to content policy";

                    // Try with a simplified prompt if content policy was violated
                    try {
                      console.log("Attempting with simplified prompt...");
                      const simplifiedPrompt = `A safe, child-friendly ${styleDescription} illustration for page ${
                        index + 1
                      } of a children's story.`;

                      const response = await openai.images.generate({
                        model: "dall-e-3",
                        prompt: simplifiedPrompt,
                        n: 1,
                        size: "1024x1024",
                      });

                      const imageUrl = response.data[0]?.url;
                      if (imageUrl) {
                        console.log(
                          `✅ Generated image with simplified prompt`
                        );
                        return imageUrl;
                      }
                    } catch (retryError) {
                      console.error(
                        "Simplified prompt also failed:",
                        retryError
                      );
                    }
                  } else if (statusCode === 429) {
                    errorType = "RATE_LIMIT_EXCEEDED";
                    errorMessage = "Rate limit exceeded for image generation";
                  } else if (statusCode === 401) {
                    errorType = "AUTHENTICATION_ERROR";
                    errorMessage = "Invalid API key or authentication error";
                  } else if (statusCode === 500) {
                    errorType = "SERVER_ERROR";
                    errorMessage = "OpenAI server error";
                  }
                } else if (error.code === "ECONNABORTED") {
                  errorType = "TIMEOUT_ERROR";
                  errorMessage = "Request timed out";
                }

                // Log detailed error information
                logApiOperation("Image generation error", {
                  errorType,
                  errorMessage,
                  page: index + 1,
                  promptExcerpt: promptString.substring(0, 100) + "...",
                });

                // Return placeholder image with error type embedded in URL
                usedFallbackImages = true;
                return `https://placehold.co/1024x1024/EEE/999?text=Image+Generation+Failed`;
              }
            }
          );

          // Only process cover + 1 page
          imageUrls = await Promise.all(
            imagePromisesWithFallback.slice(
              0,
              FEATURE_FLAGS.MAX_STORY_PAGES + 1
            )
          );

          console.log(
            `✅ Created ${
              imageUrls.filter((url) => !url.includes("placehold.co")).length
            } illustrations (limited to cover + ${
              FEATURE_FLAGS.MAX_STORY_PAGES
            } page)`
          );
        } catch (error) {
          console.error("❌ Error with batch image generation:", error);
          // Fallback to placeholder images
          imageUrls = [
            `https://placehold.co/1024x1024/FF8C42/ffffff?text=Cover:+${storyData.title}`,
            ...generatePlaceholderImages(
              storyData.pages.slice(0, FEATURE_FLAGS.MAX_STORY_PAGES),
              style,
              childName
            ),
          ];
          usedFallbackImages = true;
        }
      }
    }

    // STEP 5: Combine everything into final response
    console.log("\n📚 STEP 5: Assembling final storybook...");

    // Determine if we need to limit preview pages
    const allPages = [
      // First page is cover page with title but no text content
      {
        text: "", // The cover doesn't need text as it's displayed in the image
        imageUrl:
          imageUrls[0] ||
          `https://placehold.co/1024x1024/FF8C42/ffffff?text=Cover:+${storyData.title}`,
        isPreview: true, // Cover is always shown in preview
      },
      // Story content pages with text and images
      ...storyData.pages.map((page: any, index: number) => ({
        ...page,
        imageUrl:
          imageUrls[index + 1] || // +1 because first image is cover
          `https://placehold.co/1024x1024/EEE/999?text=Image+Not+Available`,
        isPreview: FEATURE_FLAGS.PREVIEW_MODE
          ? index < CONFIG.PREVIEW_PAGE_COUNT
          : true,
      })),
    ];

    // Combine story text with images - removed characterDescriptions from output
    const storyWithImages = {
      title: storyData.title,
      language: isSpanish ? "Spanish" : "English",
      totalPages: allPages.length,
      previewPages: FEATURE_FLAGS.PREVIEW_MODE
        ? CONFIG.PREVIEW_PAGE_COUNT + 1
        : allPages.length, // +1 for cover
      pages: allPages,
      _debug: {
        promptsGenerated: allPrompts.length,
        imagesGenerated: imageUrls.filter(
          (url) => !url.includes("placehold.co")
        ).length,
        generationTime: `${Date.now() - startTime}ms`,
        usedFallbackImages,
        imageGenerationDisabled: !FEATURE_FLAGS.ENABLE_IMAGE_GENERATION,
        useplaceholderImages: FEATURE_FLAGS.USE_PLACEHOLDER_IMAGES,
        previewMode: FEATURE_FLAGS.PREVIEW_MODE,
        apiKeyStatus: {
          OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
          NEXT_PUBLIC_OPENAI_API_KEY_EXISTS:
            !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        },
      },
    };

    console.log("✅ Storybook successfully created!");
    console.log("------------------------------------------------");

    return NextResponse.json(storyWithImages);
  } catch (error) {
    console.error("❌ Error generating story:", error);
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
}

// Determine age group for content customization
function getAgeGroup(age: string | number | undefined): string {
  if (!age) return "middle"; // Default to middle childhood

  const ageNum = typeof age === "string" ? parseInt(age, 10) : age;

  if (isNaN(ageNum)) return "middle";

  if (ageNum <= 3) return "toddler";
  if (ageNum <= 6) return "early";
  if (ageNum <= 9) return "middle";
  return "older";
}

// Generate English story prompt
function generateEnglishStoryPrompt(
  childName: string,
  themeDescription: string,
  pageCount: number,
  ageGroup: string
): string {
  let complexity = "simple sentences";
  let vocabulary = "basic";

  if (ageGroup === "middle") {
    complexity = "more complex sentences with some compound structures";
    vocabulary = "moderately advanced";
  } else if (ageGroup === "older") {
    complexity =
      "varied sentence structures including compound and complex sentences";
    vocabulary = "rich and diverse";
  }

  return `Create a ${pageCount}-page children's storybook for a child named ${childName}. 
  The story should be about ${themeDescription}. 
  The story should be engaging, age-appropriate for ${ageGroup} childhood, and have a clear beginning, middle, and end.
  Use ${complexity} and ${vocabulary} vocabulary appropriate for the age group.
  Format your response as JSON with the following structure:
  {
    "title": "The Story Title",
    "pages": [
      ${Array(pageCount)
        .fill(0)
        .map((_, i) => `{"text": "Page ${i + 1} text here..."}`)
        .join(",\n      ")}
    ]
  }
  Make sure each page has approximately 2-3 sentences suitable for a children's book. Include ${childName} as the main character in the story.`;
}

// Generate Spanish story prompt
function generateSpanishStoryPrompt(
  childName: string,
  themeDescription: string,
  pageCount: number,
  ageGroup: string
): string {
  let complexity = "oraciones simples";
  let vocabulary = "básico";

  if (ageGroup === "middle") {
    complexity = "oraciones más complejas con algunas estructuras compuestas";
    vocabulary = "moderadamente avanzado";
  } else if (ageGroup === "older") {
    complexity =
      "estructuras de oraciones variadas, incluyendo compuestas y complejas";
    vocabulary = "rico y diverso";
  }

  return `Crea un libro de cuentos infantil de ${pageCount} páginas para un niño llamado ${childName}. 
  La historia debe tratar sobre ${themeDescription}. 
  La historia debe ser atractiva, apropiada para la ${
    ageGroup === "toddler"
      ? "primera"
      : ageGroup === "early"
      ? "temprana"
      : ageGroup === "middle"
      ? "media"
      : "tardía"
  } infancia, y tener un claro principio, desarrollo y final.
  Utiliza ${complexity} y vocabulario ${vocabulary} apropiado para el grupo de edad.
  Formatea tu respuesta como JSON con la siguiente estructura:
  {
    "title": "El título del cuento",
    "pages": [
      ${Array(pageCount)
        .fill(0)
        .map((_, i) => `{"text": "Texto de la página ${i + 1} aquí..."}`)
        .join(",\n      ")}
    ]
  }
  Asegúrate de que cada página tenga aproximadamente 2-3 frases adecuadas para un libro infantil. Incluye a ${childName} como personaje principal de la historia.`;
}

// Generate English character description prompt
function generateEnglishCharacterPrompt(
  storyData: any,
  childName: string
): string {
  return `Based on this children's story titled "${
    storyData.title
  }", create detailed visual descriptions of the main characters, especially ${childName}, that can be used to maintain visual consistency across all illustrations. Include details about appearance, clothing, and any distinguishing features. Format your response as a JSON object with character names as keys and their descriptions as values.

Story summary:
${storyData.pages.map((page: any) => page.text).join(" ")}`;
}

// Generate Spanish character description prompt
function generateSpanishCharacterPrompt(
  storyData: any,
  childName: string
): string {
  return `Basado en este cuento infantil titulado "${
    storyData.title
  }", crea descripciones visuales detalladas de los personajes principales, especialmente ${childName}, que se puedan utilizar para mantener la consistencia visual en todas las ilustraciones. Incluye detalles sobre apariencia, vestimenta y cualquier característica distintiva. Formatea tu respuesta como un objeto JSON con los nombres de los personajes como claves y sus descripciones como valores.

Resumen de la historia:
${storyData.pages.map((page: any) => page.text).join(" ")}`;
}

// Helper function for theme descriptions
function getThemeDescription(
  theme: string,
  customPrompt: string | undefined,
  isSpanish: boolean
): string {
  // If custom prompt is provided, use that instead of predefined themes
  if (customPrompt && customPrompt.trim()) {
    return customPrompt.trim();
  }

  if (isSpanish) {
    const themeMapSpanish: Record<string, string> = {
      moral:
        "un viaje que enseña importantes lecciones de vida sobre honestidad, amabilidad, responsabilidad, perseverancia o valentía. La historia debe incluir un claro desafío moral que el personaje principal supera, aprendiendo una valiosa lección que se expresa de manera amigable para niños. El mensaje debe entretejerse naturalmente en la historia en lugar de expresarse explícitamente.",

      social:
        "desarrollar amistad, cooperación y habilidades sociales. La historia debe presentar interacciones con otros personajes donde el personaje principal aprende a compartir, comunicarse efectivamente, resolver conflictos pacíficamente o trabajar como parte de un equipo. La narrativa debe mostrar ejemplos positivos de relaciones saludables e inteligencia emocional apropiada para niños pequeños.",

      knowledge:
        "una aventura que introduce conceptos educativos sobre el mundo, ciencia, arte, historia o cómo funcionan las cosas. La historia debe incorporar hechos fascinantes y descubrimientos que despiertan la curiosidad mientras permanece atractiva y accesible para los niños. Los elementos educativos deben integrarse perfectamente en la trama en lugar de presentarse como lecciones.",

      fantasy:
        "un viaje imaginativo con elementos mágicos o fantásticos, donde lo extraordinario se hace posible. La historia debe transportar al lector a un mundo con reglas únicas, criaturas mágicas, objetos encantados o poderes especiales. Los elementos de fantasía deben mejorar la narrativa y crear un sentido de asombro mientras mantienen una historia emocionalmente resonante.",
    };
    return (
      themeMapSpanish[theme] ||
      "una aventura divertida y atractiva con personajes memorables y un mensaje edificante"
    );
  } else {
    const themeMapEnglish: Record<string, string> = {
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
      themeMapEnglish[theme] ||
      "a fun and engaging adventure with memorable characters and an uplifting message"
    );
  }
}

// Helper function for style descriptions
function getStyleDescription(style: string, isSpanish: boolean): string {
  if (isSpanish) {
    const styleMapSpanish: Record<string, string> = {
      pixar:
        "animación en 3D estilo Pixar con personajes redondeados y expresivos, efectos de iluminación realistas y texturas altamente detalladas. Las ilustraciones deben tener profundidad y dimensión, paleta de colores cálida, sombras suaves y un mundo ligeramente estilizado pero creíble con meticulosa atención a los detalles ambientales. Los personajes deben tener expresiones faciales exageradas que transmitan claramente las emociones.",

      watercolor:
        "suaves y soñadoras pinturas de acuarela con delicadas pinceladas, suaves lavados de color y mezclas sutiles. Las ilustraciones deben tener una calidad translúcida con textura de papel visible, colores sangrados e imperfecciones artísticas. La paleta debe ser suave y armoniosa con una sensación ligera y aérea, utilizando eficazmente el espacio en blanco. Los bordes deben ser fluidos en lugar de nítidos, creando un ambiente suave y contemplativo.",

      cartoon:
        "dibujos animados brillantes y divertidos con contornos audaces, colores planos vibrantes y formas simplificadas. Las ilustraciones deben ser enérgicas con proporciones exageradas, poses dinámicas y siluetas fuertes. Los diseños de personajes deben ser distintivos y memorables con formas claras y caras expresivas. El aspecto general debe ser alegre y animado con sensación de movimiento y diversión.",

      storybook:
        "ilustraciones clásicas de libros para niños con ricos detalles, técnicas tradicionales y una calidad atemporal. Las ilustraciones deben presentar cuidadosa atención a la composición, esquemas de color equilibrados y finos elementos decorativos. Los diseños de personajes deben ser encantadores y cercanos con ambientes cálidos y acogedores. El estilo debe evocar nostalgia mientras permanece fresco y atractivo, con un equilibrio perfecto de detalle y simplicidad.",

      disney:
        "ilustraciones clásicas de Disney con personajes expresivos, movimiento fluido y atención a pequeños detalles encantadores. Las ilustraciones deben tener un aspecto mágico y de cuento de hadas con colores vibrantes, profundidad atmosférica y una sensación de asombro. Los personajes deben tener ojos grandes y expresivos, movimientos dinámicos y personalidades claras. El ambiente general debe ser encantador y transportar a los lectores a un mundo donde todo es posible.",

      minimalist:
        "diseño moderno y minimalista con formas simples, colores sólidos y mucho espacio negativo. Las ilustraciones deben ser elegantes y contemporáneas con una paleta de colores limitada pero impactante. Los personajes deben estar representados con las líneas y formas más esenciales, comunicando mucho con muy poco. El enfoque debe estar en la simplicidad, la geometría limpia y las composiciones perfectamente equilibradas que atraen con su sofisticada sencillez.",
    };
    return (
      styleMapSpanish[style] ||
      "ilustraciones de libros infantiles coloridas y atractivas con personajes encantadores y fondos ricos y detallados que complementan perfectamente la historia"
    );
  } else {
    const styleMapEnglish: Record<string, string> = {
      pixar:
        "3D Pixar-style animation with rounded, expressive characters, realistic lighting effects, and highly detailed textures. The illustrations should have depth and dimension, warm color palette, soft shadows, and a slightly stylized but believable world with meticulous attention to environmental details. Characters should have exaggerated facial expressions that clearly convey emotions.",

      watercolor:
        "soft, dreamy watercolor paintings with delicate brushstrokes, gentle color washes, and subtle blending. The illustrations should have a translucent quality with visible paper texture, bleeding colors, and artistic imperfections. The palette should be soft and harmonious with a light, airy feel, using white space effectively. Edges should be fluid rather than sharp, creating a gentle, contemplative mood.",

      cartoon:
        "bright, playful cartoon-style with bold outlines, vibrant flat colors, and simplified shapes. The illustrations should be energetic with exaggerated proportions, dynamic poses, and strong silhouettes. Character designs should be distinctive and memorable with clear shapes and expressive faces. The overall look should be cheerful and lively with a sense of movement and fun.",

      storybook:
        "classic children's book illustrations with rich details, traditional techniques, and a timeless quality. The illustrations should feature careful attention to composition, balanced color schemes, and fine decorative elements. Character designs should be charming and relatable with warm, inviting environments. The style should evoke nostalgia while remaining fresh and engaging, with a perfect balance of detail and simplicity.",

      disney:
        "classic Disney illustrations with expressive characters, fluid movement, and attention to small, charming details. The illustrations should have a magical, fairytale look with vibrant colors, atmospheric depth, and a sense of wonder. Characters should have large, expressive eyes, dynamic movements, and clear personalities. The overall feel should be enchanting and transport readers to a world where anything is possible.",

      minimalist:
        "modern minimalist design with simple shapes, solid colors, and plenty of negative space. The illustrations should be sleek and contemporary with a limited but impactful color palette. Characters should be depicted with the most essential lines and shapes, communicating much with very little. The focus should be on simplicity, clean geometry, and perfectly balanced compositions that appeal with their sophisticated simplicity.",
    };
    return (
      styleMapEnglish[style] ||
      "colorful and engaging children's book illustrations with appealing characters and rich, detailed backgrounds that complement the story perfectly"
    );
  }
}

// Helper function to generate placeholder images
function generatePlaceholderImages(
  storyData: any,
  style: string,
  childName: string
): string[] {
  console.log("Generating placeholder images as fallback");

  // Create placeholder images with some variation
  return storyData.pages.map((page: any, index: number) => {
    // Extract keywords from the page text to make unique placeholder images
    const words = page.text
      .split(/\s+/)
      .filter((word: string) => word.length > 3) // Only words longer than 3 chars
      .slice(0, 3) // Take up to 3 keywords
      .join("+");

    const colors = [
      "9089fc/ffffff", // purple
      "90caf9/333333", // blue
      "a5d6a7/333333", // green
      "ffcc80/333333", // orange
      "ef9a9a/ffffff", // red
    ];

    // Use a different color for each page
    const colorPair = colors[index % colors.length];

    // Generate a unique placeholder with page number, style and some keywords
    return `https://placehold.co/600x400/${colorPair}?text=Page+${
      index + 1
    }:+${style}+style+(${words || childName})`;
  });
}
