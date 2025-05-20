import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import {
  createCharacterProfilePrompt,
  formatConsistentCharacterPrompt,
  createCoverImagePrompt,
  createPageImagePrompt,
} from "../../../utils/characterConsistency";
import { NextResponse } from "next/server";
import { uploadToS3, generateS3Key } from "@/app/utils/s3Client";

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
      mainCharacter = requestData.childName || "protagonist",
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
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Create a unique folder name for this story
    const folderName = title
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();

    // Step 1: Generate a detailed character profile using GPT-4
    console.log(`[${requestId}] 👤 Generating detailed character profile...`);

    const characterPrompt = createCharacterProfilePrompt(mainCharacter);

    const characterResponse = await openai.chat.completions.create({
      model: "gpt-4",
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

    // Generate cover image
    console.log(`[${requestId}] 🖼️ Generating cover image...`);

    const consistentCharacterPrompt =
      formatConsistentCharacterPrompt(characterProfile);
    const coverPrompt = createCoverImagePrompt(
      title,
      storyData.coverDescription,
      characterProfile,
      styleDescription,
      mainCharacter
    );

    try {
      // Generate the cover image
      const coverImageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: coverPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      });

      const coverImageUrl = coverImageResponse.data[0].url;

      // Download the cover image
      const coverImageFetchResponse = await fetch(coverImageUrl);
      const coverImageBuffer = await coverImageFetchResponse.arrayBuffer();

      // Upload to S3
      const coverImageKey = generateS3Key(`stories/${folderName}`, "cover.png");
      const coverImageS3Url = await uploadToS3(
        Buffer.from(coverImageBuffer),
        coverImageKey,
        "image/png"
      );

      console.log(`[${requestId}] ✅ Cover image created and uploaded to S3`);

      // Generate illustrations for each page
      console.log(`[${requestId}] 📚 Generating page illustrations...`);
      const pageUrls = [];

      // Generate all story pages
      for (let i = 0; i < storyData.pages.length; i++) {
        const pageNum = i + 1;
        const page = storyData.pages[i];

        // Create page illustration prompt
        const pagePrompt = createPageImagePrompt(
          pageNum,
          page.imageDescription,
          characterProfile,
          styleDescription,
          mainCharacter
        );

        console.log(
          `[${requestId}] 🖌️ Generating illustration for page ${pageNum}/${storyData.pages.length}...`
        );

        try {
          // Generate the page image
          const pageImageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: pagePrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid",
          });

          const pageImageUrl = pageImageResponse.data[0].url;

          // Download the page image
          const pageImageFetchResponse = await fetch(pageImageUrl);
          const pageImageBuffer = await pageImageFetchResponse.arrayBuffer();

          // Upload to S3
          const pageImageKey = generateS3Key(
            `stories/${folderName}`,
            `page${pageNum}.png`
          );
          const pageImageS3Url = await uploadToS3(
            Buffer.from(pageImageBuffer),
            pageImageKey,
            "image/png"
          );

          pageUrls.push(pageImageS3Url);
          console.log(
            `[${requestId}] ✅ Page ${pageNum} illustration created and uploaded to S3`
          );

          // Add rate limiting delay between generations
          if (i < storyData.pages.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(
            `[${requestId}] ❌ Error generating page ${pageNum}:`,
            error.message
          );
          throw error;
        }
      }

      // Store story data in S3
      const storyDataKey = generateS3Key(`stories/${folderName}`, "story.json");
      await uploadToS3(
        Buffer.from(
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
        ),
        storyDataKey,
        "application/json"
      );

      console.log(
        `[${requestId}] 🎉 Story and illustration generation complete!`
      );

      // Return the results including all story data for future use
      return NextResponse.json({
        success: true,
        title: storyData.title,
        coverImage: coverImageS3Url,
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
      });
    } catch (error) {
      console.error(`[${requestId}] ❌ Error:`, error);
      return NextResponse.json(
        {
          error: "Failed to generate story and images",
          message: error.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    return NextResponse.json(
      {
        error: "Failed to generate story and images",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
