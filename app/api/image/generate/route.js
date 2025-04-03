import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting constants for DALL-E 3
const BATCH_SIZE = 5; // Maximum images per batch
const BATCH_DELAY = 62000; // Wait ~62 seconds between batches (just over 1 minute)

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

    const characterPrompt = `Create a detailed character profile for a children's book protagonist named ${mainCharacter}. 
    Include specific, consistent details about:
    1. Physical appearance (age, height, hair color and style, eye color, skin tone, distinctive features)
    2. Clothing and accessories (colors, style, unique items)
    3. Personality traits that might be reflected visually
    4. Any other visual elements that should remain consistent across illustrations
    
    Use a structured format with clear categories that can be easily referenced for consistency across multiple illustrations. 
    Be very specific about each physical characteristic to ensure visual consistency.`;

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
      Make sure character visual details stay consistent with the profile. The illustrations should be visually rich and varied from page to page.`;

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

    // Generate cover image without any text
    console.log(`[${requestId}] 🖼️ Generating cover image...`);

    const coverPrompt = `Create a front cover illustration for a children's book titled "${title}", ${styleDescription}.
${storyData.coverDescription}

Character Profile details to maintain consistently:
${characterProfile}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration that visually represents the story theme
2. NO words, lettering, labels, or text elements of any kind should appear
3. Create a direct illustration, NOT a photograph or meta-representation of a book
5. Maintain character consistency by strictly following these details:
   - Character name: ${mainCharacter}
   - All physical characteristics - age, height, hair, eyes, skin, etc. including all clothing and accessories exactly as described in the Character profile`;

    const coverImageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: coverPrompt,
      n: 1,
      size: "1024x1024",
    });

    const coverImageUrl = coverImageResponse.data[0].url;

    // Download the cover image
    const coverImageResponse2 = await fetch(coverImageUrl);
    const coverImageBuffer = Buffer.from(
      await coverImageResponse2.arrayBuffer()
    );
    const coverImagePath = path.join(bookDir, "cover.png");
    await fs.writeFile(coverImagePath, coverImageBuffer);

    console.log(`[${requestId}] ✅ Cover image created and saved`);

    // Generate illustrations for each page
    console.log(`[${requestId}] 📚 Generating page illustrations...`);

    const pageUrls = [];

    // FOR NOW: Generate only the first page image
    // In the future, this will be updated to generate all pages
    console.log(
      `[${requestId}] ℹ️ Currently generating only the first page image`
    );

    if (storyData.pages.length > 0) {
      const page = storyData.pages[0];

      const pagePrompt = `Create an illustration for page 1 of a children's story-book ${styleDescription}.

Scene description:
${page.imageDescription}

Character Profile details to maintain consistently:
${characterProfile}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration that visually represents the story theme
2. NO words, lettering, labels, or text elements of any kind should appear
3. Create a direct illustration, NOT a photograph or meta-representation of a book
5. Maintain character consistency by strictly following these details:
   - Character name: ${mainCharacter}
   - All physical characteristics - age, height, hair, eyes, skin, etc. including all clothing and accessories exactly as described in the Character profile`;

      console.log(`[${requestId}] 🖌️ Generating illustration for page 1...`);

      try {
        const pageImageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: pagePrompt,
          n: 1,
          size: "1024x1024",
        });

        const pageImageUrl = pageImageResponse.data[0].url;

        // Download the page image
        const pageImageResponse2 = await fetch(pageImageUrl);
        const pageImageBuffer = Buffer.from(
          await pageImageResponse2.arrayBuffer()
        );
        const pageImagePath = path.join(bookDir, `page1.png`);
        await fs.writeFile(pageImagePath, pageImageBuffer);

        pageUrls.push(`/stories/${folderName}/page1.png`);
        console.log(`[${requestId}] ✅ Page 1 illustration created and saved`);
      } catch (error) {
        console.error(
          `[${requestId}] ❌ Error generating page 1:`,
          error.message
        );
      }
    }

    /* FUTURE IMPLEMENTATION: Process all pages in batches to respect rate limits
    for (let i = 0; i < storyData.pages.length; i++) {
      const page = storyData.pages[i];
      
      // Add rate limiting delay between batches
      if (i > 0 && i % BATCH_SIZE === 0) {
        console.log(`[${requestId}] ⏱️ Rate limit pause - waiting 62 seconds before continuing...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
      
      const pagePrompt = `Create an illustration for page ${i+1} of a children's book ${styleDescription}.

Scene description:
${page.imageDescription}

Character Profile details to maintain consistently:
${characterProfile}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY TEXT in the illustration - ABSOLUTELY NO TEXT
2. Create ONLY a text-free illustration that visually represents the scene
3. NO words, letters, numbers, labels, speech bubbles or text elements of any kind
4. Create a direct illustration, NOT a photograph or meta-representation of a book
5. The story text will be added separately later - do not try to include it
6. Maintain character consistency by strictly following these details:
   - Character name: ${mainCharacter} 
   - All physical characteristics exactly as described in the profile (age, height, hair, eyes, skin, etc.)
   - All clothing and accessories exactly as described in the profile`;

      console.log(`[${requestId}] 🖌️ Generating illustration for page ${i+1}...`);
      
      try {
        const pageImageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: pagePrompt,
          n: 1,
          size: "1024x1024",
        });
        
        const pageImageUrl = pageImageResponse.data[0].url;
        
        // Download the page image
        const pageImageResponse2 = await fetch(pageImageUrl);
        const pageImageBuffer = Buffer.from(await pageImageResponse2.arrayBuffer());
        const pageImagePath = path.join(bookDir, `page${i+1}.png`);
        await fs.writeFile(pageImagePath, pageImageBuffer);
        
        pageUrls.push(`/stories/${folderName}/page${i+1}.png`);
        console.log(`[${requestId}] ✅ Page ${i+1} illustration created and saved`);
      } catch (error) {
        console.error(`[${requestId}] ❌ Error generating page ${i+1}:`, error.message);
        // Continue with other pages even if one fails
      }
    }
    */

    console.log(
      `[${requestId}] 🎉 Story and illustration generation complete!`
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
      allPagesGenerated: false, // Flag indicating not all pages were generated
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
