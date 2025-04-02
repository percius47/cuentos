import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
import path from "path";

// Sample image URLs to download and save locally
const SAMPLE_IMAGES = {
  cover:
    "https://placehold.co/1024x1024/4B7BE5/ffffff?text=Sample+Cover+(Local)",
  page1:
    "https://placehold.co/1024x1024/E4572E/ffffff?text=Sample+Page+1+(Local)",
};

// Local paths where images will be saved
const LOCAL_PATHS = {
  directory: "./public/images/sample",
  cover: "./public/images/sample/cover.png",
  page1: "./public/images/sample/page1.png",
};

/**
 * Downloads an image from a URL and saves it to the local filesystem
 */
async function downloadImage(
  url: string,
  outputPath: string
): Promise<boolean> {
  try {
    console.log(`Downloading image from ${url} to ${outputPath}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    try {
      await mkdir(dir, { recursive: true });
    } catch (err) {
      console.log("Directory already exists or couldn't be created:", err);
    }

    // Write the file
    await writeFile(outputPath, buffer);

    console.log(`✅ Successfully saved image to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error downloading image:`, error);
    return false;
  }
}

/**
 * API route to set up sample images
 */
export async function GET() {
  try {
    console.log("Setting up sample images...");

    // Create directory if it doesn't exist
    try {
      await mkdir(LOCAL_PATHS.directory, { recursive: true });
    } catch (err) {
      console.log("Directory already exists or couldn't be created");
    }

    // Download images
    const coverSuccess = await downloadImage(
      SAMPLE_IMAGES.cover,
      LOCAL_PATHS.cover
    );
    const pageSuccess = await downloadImage(
      SAMPLE_IMAGES.page1,
      LOCAL_PATHS.page1
    );

    const success = coverSuccess && pageSuccess;
    console.log("✅ Sample images setup complete");

    return NextResponse.json({
      success,
      message: success
        ? "Sample images downloaded successfully"
        : "Failed to download some sample images",
      sampleImagePaths: {
        cover: "/images/sample/cover.png",
        page1: "/images/sample/page1.png",
      },
    });
  } catch (error) {
    console.error("❌ Error setting up sample images:", error);
    return NextResponse.json(
      {
        error: "Failed to set up sample images",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
