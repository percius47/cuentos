import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Path to stories directory
const STORIES_DIR = path.join(process.cwd(), "public", "stories");

export async function GET() {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(STORIES_DIR)) {
      fs.mkdirSync(STORIES_DIR, { recursive: true });
      return NextResponse.json({ stories: [] });
    }

    // Read all story folders
    const storyFolders = fs
      .readdirSync(STORIES_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // Load story data for each folder
    const stories = storyFolders
      .map((folder) => {
        const storyPath = path.join(STORIES_DIR, folder, "story.json");

        if (fs.existsSync(storyPath)) {
          try {
            const storyData = JSON.parse(fs.readFileSync(storyPath, "utf8"));
            return {
              title: storyData.title,
              folder: folder,
              timestamp: storyData.timestamp || new Date().toISOString(),
              pageCount: storyData.pages?.length || 0,
              coverImage: `/stories/${folder}/cover.png`,
              pdfPath: `/stories/${folder}/${folder}.pdf`,
            };
          } catch (e) {
            console.error(`Error parsing story data for ${folder}:`, e);
            return null;
          }
        } else {
          return {
            title: folder.replace(/_/g, " "),
            folder: folder,
            timestamp: new Date().toISOString(),
            pageCount: 0,
            coverImage: null,
            pdfPath: null,
          };
        }
      })
      .filter(Boolean);

    // Sort by newest first
    stories.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Error listing stories:", error);
    return NextResponse.json(
      {
        error: "Failed to list stories",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
