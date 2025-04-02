import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generatePDF } from "@/app/utils/pdfGenerator";

// Path to store story files
const STORIES_DIR = path.join(process.cwd(), "public", "stories");

// Helper to sanitize a string for use as a folder name
function sanitizeForFolder(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

// Helper to save a file from a URL to disk (server-side only)
async function saveImageFromUrl(
  imageUrl: string,
  outputPath: string
): Promise<boolean> {
  try {
    console.log(
      `Saving image from ${imageUrl.substring(0, 50)}... to ${outputPath}`
    );

    // If it's already a local file
    if (imageUrl.startsWith("/")) {
      const sourcePath = path.join(process.cwd(), "public", imageUrl);

      if (fs.existsSync(sourcePath)) {
        // Copy the file instead of downloading
        fs.copyFileSync(sourcePath, outputPath);
        console.log(
          `✅ Copied local image from ${sourcePath} to ${outputPath}`
        );
        return true;
      } else {
        console.error(`Source file doesn't exist: ${sourcePath}`);
        return false;
      }
    }

    // Download remote file
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write the file
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Image saved successfully to ${outputPath}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to save image:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get story data from request
    const { storyTitle, pages } = await request.json();

    if (!storyTitle || !pages || !Array.isArray(pages)) {
      return NextResponse.json(
        { error: "Missing required story data" },
        { status: 400 }
      );
    }

    // Create sanitized folder name
    const folderName = sanitizeForFolder(storyTitle);
    const storyFolder = path.join(STORIES_DIR, folderName);

    // Create the story folder if it doesn't exist
    console.log(`Creating story folder: ${storyFolder}`);
    if (!fs.existsSync(STORIES_DIR)) {
      fs.mkdirSync(STORIES_DIR, { recursive: true });
    }
    if (!fs.existsSync(storyFolder)) {
      fs.mkdirSync(storyFolder, { recursive: true });
    }

    // Save all images
    const savedImagePaths = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.imageUrl) {
        const imageName = i === 0 ? "cover.png" : `page_${i}.png`;
        const imagePath = path.join(storyFolder, imageName);

        const success = await saveImageFromUrl(page.imageUrl, imagePath);
        if (success) {
          // Update the URL to the local path
          const newPath = `/stories/${folderName}/${imageName}`;
          pages[i].imageUrl = newPath;
          savedImagePaths.push(newPath);
        }
      }
    }

    // Save story data as JSON
    const storyDataPath = path.join(storyFolder, "story.json");
    fs.writeFileSync(
      storyDataPath,
      JSON.stringify(
        {
          title: storyTitle,
          pages: pages,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // Generate and save PDF
    const storyData = { title: storyTitle, pages: pages };
    const pdfBytes = await generatePDF(storyData);
    const pdfPath = path.join(storyFolder, `${folderName}.pdf`);
    fs.writeFileSync(pdfPath, pdfBytes);

    return NextResponse.json({
      success: true,
      message: "Story saved successfully",
      storyFolder: `/stories/${folderName}`,
      savedFiles: {
        pdf: `/stories/${folderName}/${folderName}.pdf`,
        json: `/stories/${folderName}/story.json`,
        images: savedImagePaths,
      },
    });
  } catch (error) {
    console.error("Error saving story:", error);
    return NextResponse.json(
      {
        error: "Failed to save story",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
