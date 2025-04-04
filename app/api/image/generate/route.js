import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import {
  createCharacterProfilePrompt,
  formatConsistentCharacterPrompt,
  createCoverImagePrompt,
  createPageImagePrompt,
} from "../../../utils/characterConsistency";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting constants for DALL-E 3
const BATCH_SIZE = 5; // Maximum images per batch
const BATCH_DELAY = 62000; // Wait ~62 seconds between batches (just over 1 minute)

// Add a helper function for retrying image generation
async function generateImageWithRetry(requestId, prompt, maxRetries = 2) {
  let attempt = 0;
  let error;

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(
        `[${requestId}] Attempt ${attempt}/${maxRetries} for image generation`
      );

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      return response.data[0].url;
    } catch (err) {
      error = err;
      console.error(
        `[${requestId}] ❌ Attempt ${attempt} failed: ${err.message}`
      );

      // If we have more attempts, wait before retrying
      if (attempt < maxRetries) {
        const delay = 3000 * attempt; // Progressive backoff
        console.log(
          `[${requestId}] Waiting ${delay / 1000} seconds before retry...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If we get here, all attempts failed
  throw error || new Error("Failed to generate image after multiple attempts");
}

// Add a helper function for downloading images with retry
async function downloadImageWithRetry(
  requestId,
  imageUrl,
  outputPath,
  maxRetries = 3
) {
  let attempt = 0;
  let error;

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`[${requestId}] Download attempt ${attempt}/${maxRetries}`);

      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outputPath, imageBuffer);

      return true;
    } catch (err) {
      error = err;
      console.error(
        `[${requestId}] ❌ Download attempt ${attempt} failed: ${err.message}`
      );

      if (attempt < maxRetries) {
        const delay = 2000 * attempt; // Progressive backoff
        console.log(
          `[${requestId}] Waiting ${delay / 1000} seconds before retry...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw error || new Error("Failed to download image after multiple attempts");
}

// Helper function to save generation progress
async function saveGenerationProgress(bookDir, progress) {
  try {
    const progressPath = path.join(bookDir, "generation_progress.json");
    await fs.writeFile(
      progressPath,
      JSON.stringify(
        {
          ...progress,
          lastUpdated: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Error saving generation progress:", error);
    // Non-critical error, can continue without it
  }
}

// Helper function to check existing generation progress
async function checkExistingProgress(bookDir) {
  try {
    const progressPath = path.join(bookDir, "generation_progress.json");
    const progressData = await fs.readFile(progressPath, "utf8");
    return JSON.parse(progressData);
  } catch (error) {
    // File doesn't exist or can't be read, return default progress
    return {
      coverGenerated: false,
      pagesGenerated: [],
      failedPages: [],
    };
  }
}

export async function POST(request) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] 🚀 Story and image generation process started`);

  try {
    // Get input parameters from the request
    const requestData = await request.json();

    // Extract all possible parameters with defaults
    const {
      title,
      coverDescription,
      pages,
      illustrationStyle,
      mainCharacter = requestData.childName || "protagonist", // Use childName as fallback
      theme = "general story",
      language = "english",
      ageRange,
    } = requestData;

    console.log(
      `[${requestId}] 📝 Received parameters: title="${title}", character="${mainCharacter}", theme="${theme}", style="${illustrationStyle}"`
    );

    // Validate required inputs with detailed error messages
    const missingParams = [];
    if (!title) missingParams.push("title");
    if (!pages || !Array.isArray(pages) || pages.length === 0)
      missingParams.push("pages");
    if (!illustrationStyle) missingParams.push("illustrationStyle");

    if (missingParams.length > 0) {
      const errorMsg = `Missing required parameters: ${missingParams.join(
        ", "
      )}`;
      console.error(`[${requestId}] ❌ Error: ${errorMsg}`);
      return Response.json({ error: errorMsg }, { status: 400 });
    }

    // Create directory for saving images
    const folderName = title
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
    const storiesDir = path.join(process.cwd(), "public", "stories");
    const bookDir = path.join(storiesDir, folderName);

    await fs.mkdir(bookDir, { recursive: true });
    console.log(`[${requestId}] 📁 Created directory: ${bookDir}`);

    // Step 1: Generate a detailed character profile using GPT-4o
    console.log(`[${requestId}] 👤 Generating detailed character profile...`);

    const characterPrompt = createCharacterProfilePrompt(mainCharacter);

    const characterResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: characterPrompt }],
      temperature: 0.7,
    });

    const characterProfile = characterResponse.choices[0].message.content;
    console.log(`[${requestId}] ✅ Character profile text generated`);

    // If we already have pages from the request, skip the story generation step
    let storyData;

    if (pages && coverDescription) {
      console.log(
        `[${requestId}] ℹ️ Using provided story data (${pages.length} pages)`
      );
      storyData = { title, coverDescription, pages };
    } else {
      // Step 2: Generate a 5-page children's story with detailed scene descriptions
      console.log(
        `[${requestId}] 📖 Generating story with scene descriptions...`
      );

      const storyPrompt = `Write a ${language} children's story for ${
        ageRange || "ages 4-8"
      } with the title "${title}" featuring ${mainCharacter} as the protagonist. The theme is: ${theme}.

      Please include:
      1. A cover description that showcases ${mainCharacter} and captures the story's essence
      2. 8 pages of story, where each page has:
         - The actual story text that would appear on the page
         - A detailed visual description of what should be illustrated on that page (setting, character positions, actions, mood, colors, etc.)
      
      Format your response as JSON with this structure:
      {
        "title": "${title}",
        "coverDescription": "Detailed visual description for the cover illustration",
        "pages": [
          {
            "content": "The text that would appear on page 1",
            "imageDescription": "Detailed visual description for page 1's illustration"
          },
          // Pages 2-8 following the same structure
        ]
      }
      Make sure character visual details stay consistent with the profile. The illustrations should be visually rich and varied from page to page. IMAGE SHOULD ABSOLUTELY NOT CONTAIN ANY TEXT.`;

      const storyResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: characterProfile },
          { role: "user", content: storyPrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      // Parse the JSON response
      storyData = JSON.parse(storyResponse.choices[0].message.content);
      console.log(
        `[${requestId}] ✅ Story generated with ${storyData.pages.length} pages`
      );
    }

    // Save the story data with metadata
    await fs.writeFile(
      path.join(bookDir, "story.json"),
      JSON.stringify(
        {
          ...storyData,
          characterProfile,
          theme,
          mainCharacter,
          illustrationStyle,
          language,
          ageRange,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );

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

    // Check if we have any existing progress
    const existingProgress = await checkExistingProgress(bookDir);
    console.log(
      `[${requestId}] 🔍 Checking for existing generation progress...`
    );

    // Generate cover image if not already generated
    if (!existingProgress.coverGenerated) {
      console.log(`[${requestId}] 🖼️ Generating cover image...`);

      // Use the utility function to create a consistent character prompt
      const consistentCharacterPrompt =
        formatConsistentCharacterPrompt(characterProfile);

      // Create cover image prompt using the utility function
      const coverPrompt = createCoverImagePrompt(
        title,
        storyData.coverDescription,
        characterProfile,
        styleDescription,
        mainCharacter
      );

      try {
        // Generate the cover image with retry logic
        const coverImageUrl = await generateImageWithRetry(
          requestId,
          coverPrompt
        );

        // Download the cover image with retry logic
        const coverImagePath = path.join(bookDir, "cover.png");
        await downloadImageWithRetry(requestId, coverImageUrl, coverImagePath);

        console.log(`[${requestId}] ✅ Cover image created and saved`);

        // Update progress
        existingProgress.coverGenerated = true;
        await saveGenerationProgress(bookDir, existingProgress);
      } catch (coverError) {
        console.error(
          `[${requestId}] ❌ Failed to generate cover image: ${coverError.message}`
        );
        return Response.json(
          { error: "Failed to generate cover image" },
          { status: 500 }
        );
      }
    } else {
      console.log(`[${requestId}] ℹ️ Cover image already generated, skipping`);
    }

    // Generate illustrations for each page
    console.log(`[${requestId}] 📚 Generating page illustrations...`);

    const pageUrls = [];

    // Generate all story pages in batches to respect rate limits
    console.log(
      `[${requestId}] 🖼️ Generating all ${storyData.pages.length} page illustrations...`
    );

    // Track generation progress
    const generationResults = {
      total: storyData.pages.length,
      successful: existingProgress.pagesGenerated.length || 0,
      failed: 0,
      failedPages: [...(existingProgress.failedPages || [])],
      pagesGenerated: [...(existingProgress.pagesGenerated || [])],
    };

    // Create a list of pages that still need to be generated
    const pagesToGenerate = [];
    for (let i = 0; i < storyData.pages.length; i++) {
      const pageNum = i + 1;
      if (!generationResults.pagesGenerated.includes(pageNum)) {
        pagesToGenerate.push(i);
      }
    }

    console.log(
      `[${requestId}] ℹ️ ${pagesToGenerate.length} pages need to be generated, ${generationResults.successful} already exist`
    );

    for (let i = 0; i < pagesToGenerate.length; i++) {
      const pageIndex = pagesToGenerate[i];
      const pageNum = pageIndex + 1;
      const page = storyData.pages[pageIndex];

      // Add rate limiting delay between batches
      if (i > 0 && i % BATCH_SIZE === 0) {
        console.log(
          `[${requestId}] ⏱️ Rate limit pause - waiting ${
            BATCH_DELAY / 1000
          } seconds before continuing...`
        );
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }

      // Create page illustration prompt using the utility function
      const pagePrompt = createPageImagePrompt(
        pageNum,
        page.imageDescription,
        characterProfile,
        styleDescription,
        mainCharacter
      );

      console.log(
        `[${requestId}] 🖌️ Generating illustration for page ${pageNum}/${
          storyData.pages.length
        } (${Math.round(
          ((i + 1) / pagesToGenerate.length) * 100
        )}% complete)...`
      );

      try {
        // Generate the page image with retry logic
        const pageImageUrl = await generateImageWithRetry(
          requestId,
          pagePrompt
        );

        // Download the page image with retry logic
        const pageImagePath = path.join(bookDir, `page${pageNum}.png`);
        await downloadImageWithRetry(requestId, pageImageUrl, pageImagePath);

        pageUrls.push(`/stories/${folderName}/page${pageNum}.png`);
        console.log(
          `[${requestId}] ✅ Page ${pageNum} illustration created and saved`
        );

        // Update generation results
        generationResults.successful++;
        generationResults.pagesGenerated.push(pageNum);

        // Save progress after each successful generation
        await saveGenerationProgress(bookDir, generationResults);
      } catch (error) {
        console.error(
          `[${requestId}] ❌ Error generating page ${pageNum}:`,
          error.message
        );
        generationResults.failed++;
        generationResults.failedPages.push(pageNum);

        // Save progress after each failed generation
        await saveGenerationProgress(bookDir, generationResults);
        // Continue with other pages even if one fails
      }
    }

    // Add already generated pages to pageUrls
    for (const pageNum of existingProgress.pagesGenerated) {
      if (!pageUrls.includes(`/stories/${folderName}/page${pageNum}.png`)) {
        pageUrls.push(`/stories/${folderName}/page${pageNum}.png`);
      }
    }

    // Log generation summary
    console.log(
      `[${requestId}] 📊 Generation summary: ${generationResults.successful}/${generationResults.total} pages successful`
    );
    if (generationResults.failedPages.length > 0) {
      console.log(
        `[${requestId}] ⚠️ Failed pages: ${generationResults.failedPages.join(
          ", "
        )}`
      );
    }

    // Check if we need to retry any failed pages
    if (
      generationResults.failedPages.length > 0 &&
      generationResults.failedPages.length < generationResults.total
    ) {
      console.log(
        `[${requestId}] 🔄 Attempting to regenerate ${generationResults.failedPages.length} failed pages...`
      );

      // Wait a bit before retrying to avoid rate limits
      console.log(
        `[${requestId}] ⏱️ Waiting 65 seconds before retrying failed pages...`
      );
      await new Promise((resolve) => setTimeout(resolve, 65000));

      // Try to regenerate each failed page
      for (const pageNum of generationResults.failedPages) {
        const pageIndex = pageNum - 1;
        const page = storyData.pages[pageIndex];

        console.log(`[${requestId}] 🔄 Regenerating page ${pageNum}...`);

        // Create a simplified prompt for the retry
        const retryPrompt = `Create an illustration for page ${pageNum} of a children's story-book ${styleDescription}.

Scene description:
${page.imageDescription}

${consistentCharacterPrompt}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, letters, labels, or text elements of any kind
3. Create a direct illustration of the scene described above
4. Character must be consistent with the description`;

        try {
          // Try with simplified prompt
          const pageImageUrl = await generateImageWithRetry(
            requestId,
            retryPrompt,
            1
          );

          // Download the page image
          const pageImagePath = path.join(bookDir, `page${pageNum}.png`);
          await downloadImageWithRetry(requestId, pageImageUrl, pageImagePath);

          // Add to page URLs if not already there
          if (!pageUrls.includes(`/stories/${folderName}/page${pageNum}.png`)) {
            pageUrls.push(`/stories/${folderName}/page${pageNum}.png`);
          }

          console.log(
            `[${requestId}] ✅ Retry successful: Page ${pageNum} illustration created and saved`
          );

          // Update generation results
          generationResults.successful++;
          generationResults.failedPages = generationResults.failedPages.filter(
            (p) => p !== pageNum
          );
          generationResults.pagesGenerated.push(pageNum);

          // Save updated progress
          await saveGenerationProgress(bookDir, generationResults);
        } catch (retryError) {
          console.error(
            `[${requestId}] ❌ Final retry failed for page ${pageNum}:`,
            retryError.message
          );
        }
      }
    }

    // Sort pageUrls numerically
    pageUrls.sort((a, b) => {
      const aNum = parseInt(a.match(/page(\d+)\.png/)?.[1] || "0");
      const bNum = parseInt(b.match(/page(\d+)\.png/)?.[1] || "0");
      return aNum - bNum;
    });

    console.log(
      `[${requestId}] 🎉 Story and illustration generation complete! ${generationResults.successful}/${generationResults.total} pages successfully generated.`
    );

    // Return the results including all story data for future use
    return Response.json({
      success: true,
      title: storyData.title,
      coverImage: `/stories/${folderName}/cover.png`,
      pageImages: pageUrls,
      pageCount: pageUrls.length,
      mainCharacter: mainCharacter,
      theme: theme,
      language: language,
      illustrationStyle: illustrationStyle,
      storyData: {
        ...storyData,
        characterProfile,
      },
      allPagesGenerated:
        generationResults.successful === generationResults.total,
      generationSummary: generationResults,
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    return Response.json(
      {
        error: "Failed to generate story and images",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
