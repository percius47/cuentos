import * as pdfLib from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fetchAsArrayBuffer } from "./fetchUtils";

const PLACEHOLDER_IMAGE_URL =
  "https://placehold.co/1024x1024/9089fc/ffffff?text=Image+Not+Available";

// Font URLs
const FONT_URLS = {
  regular: "/fonts/Montserrat-Regular.ttf",
  bold: "/fonts/Montserrat-Bold.ttf",
  italic: "/fonts/Montserrat-Italic.ttf",
};

// Text strings for UI elements in different languages
const UI_TEXT = {
  english: {
    coverTitle: "A Story for",
    page: "Page",
  },
  spanish: {
    coverTitle: "Un Cuento para",
    page: "Página",
  },
};

// Helper function to log PDF operations with timestamps
function logPdfOperation(message: string, data?: any) {
  console.log(`[PDF ${new Date().toISOString()}] ${message}`, data ? data : "");
}

// Sanitize text for PDF by removing emojis and problematic characters
function sanitizeTextForPdf(text: string): string {
  if (!text) return "";

  // Remove emojis and special characters that might cause PDF encoding issues
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Remove emojis
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "") // Remove more emojis
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Remove transport & map symbols
    .replace(/[\u{2600}-\u{26FF}]/gu, "") // Remove misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "") // Remove dingbats
    .trim();
}

// Helper function to fetch images and convert to bytes
async function fetchImageAsBytes(imageUrl: string): Promise<Uint8Array | null> {
  try {
    if (!imageUrl) return null;

    console.log(`Attempting to fetch image from: ${imageUrl}`);

    // Handle local images (paths starting with /)
    if (imageUrl.startsWith("/")) {
      console.log("Detected local image path");

      try {
        // For local paths, we need to fetch them through the app's public folder
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch local image: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        console.log(`✅ Successfully fetched local image: ${imageUrl}`);
        return new Uint8Array(arrayBuffer);
      } catch (error) {
        console.error(`Error fetching local image: ${imageUrl}`, error);
        // Fall back to placeholder
        console.log("Falling back to placeholder image");
        const response = await fetch(PLACEHOLDER_IMAGE_URL);
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    }

    // Handle remote images
    // Check if it's a placeholder image
    if (imageUrl.includes("placehold.co")) {
      logPdfOperation("Using placeholder image");
      return await fetchAsArrayBuffer(PLACEHOLDER_IMAGE_URL);
    }

    logPdfOperation("Fetching image", imageUrl.substring(0, 40) + "...");
    return await fetchAsArrayBuffer(imageUrl);
  } catch (error) {
    logPdfOperation("Error fetching image", error);
    // Return null to indicate failure
    return null;
  }
}

export async function generatePDF(storyData: any): Promise<Uint8Array> {
  logPdfOperation("Starting PDF generation", { title: storyData.title });

  const { PDFDocument, rgb, StandardFonts } = pdfLib;

  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load custom fonts
  logPdfOperation("Loading fonts");
  let regularFont;
  let boldFont;
  let italicFont;

  try {
    const regularFontData = await fetchAsArrayBuffer(FONT_URLS.regular);
    const boldFontData = await fetchAsArrayBuffer(FONT_URLS.bold);
    const italicFontData = await fetchAsArrayBuffer(FONT_URLS.italic);

    regularFont = await pdfDoc.embedFont(regularFontData);
    boldFont = await pdfDoc.embedFont(boldFontData);
    italicFont = await pdfDoc.embedFont(italicFontData);
  } catch (error) {
    logPdfOperation(
      "Error loading custom fonts, falling back to standard fonts",
      error
    );
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  }

  // Determine language
  const language = storyData.language === "spanish" ? "spanish" : "english";
  const text = UI_TEXT[language];

  // Extract story data
  const { title, pages } = storyData;
  const sanitizedTitle = sanitizeTextForPdf(title);

  // Setup page size (A4)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;

  // Define content area
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // Cover page (first page)
  const coverPage = pages[0];
  logPdfOperation("Creating cover page");

  const coverPageDoc = pdfDoc.addPage([pageWidth, pageHeight]);

  // Add title to cover
  coverPageDoc.drawText(sanitizedTitle, {
    x: margin,
    y: pageHeight - margin - 40,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: contentWidth,
  });

  // Try to add cover image
  if (coverPage.imageUrl) {
    try {
      logPdfOperation("Adding cover image");
      const imageBytes = await fetchImageAsBytes(coverPage.imageUrl);

      if (imageBytes) {
        let coverImage;
        try {
          // First try as JPG
          coverImage = await pdfDoc.embedJpg(imageBytes);
        } catch (jpgError) {
          logPdfOperation("Error embedding as JPG, trying as PNG", jpgError);
          try {
            // If that fails, try as PNG
            coverImage = await pdfDoc.embedPng(imageBytes);
          } catch (pngError) {
            throw new Error(`Failed to embed image as JPG or PNG: ${pngError}`);
          }
        }

        const imgDims = coverImage.scale(0.5); // Scale down the image

        // Calculate dimensions to fit within content area while maintaining aspect ratio
        let imgWidth = contentWidth;
        let imgHeight = (imgDims.height / imgDims.width) * imgWidth;

        // If height is too large, scale based on height instead
        if (imgHeight > contentHeight * 0.7) {
          imgHeight = contentHeight * 0.7;
          imgWidth = (imgDims.width / imgDims.height) * imgHeight;
        }

        // Center the image horizontally
        const imgX = margin + (contentWidth - imgWidth) / 2;
        const imgY = margin + contentHeight / 2;

        coverPageDoc.drawImage(coverImage, {
          x: imgX,
          y: imgY - imgHeight / 2,
          width: imgWidth,
          height: imgHeight,
        });
        console.log("✅ Successfully added cover image to PDF");
      } else {
        // Fallback text if image can't be loaded
        coverPageDoc.drawText(
          "Cover Image Not Available (Failed to load image)",
          {
            x: margin + contentWidth / 2 - 150,
            y: margin + contentHeight / 2,
            size: 14,
            font: italicFont,
            color: rgb(0.5, 0.5, 0.5),
          }
        );
      }
    } catch (error) {
      logPdfOperation("Error embedding cover image", error);
      // Show error text in place of image
      coverPageDoc.drawText(`Error loading cover image: ${error.message}`, {
        x: margin + contentWidth / 2 - 150,
        y: margin + contentHeight / 2,
        size: 14,
        font: italicFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  // Add story pages (skip the cover page)
  const contentPages = pages.slice(1);

  for (let i = 0; i < contentPages.length; i++) {
    const page = contentPages[i];
    logPdfOperation(`Adding page ${i + 1}`);

    // Create a new page
    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);

    // Add page number
    pdfPage.drawText(`${text.page} ${i + 1}`, {
      x: pageWidth - margin - 50,
      y: pageHeight - margin,
      size: 10,
      font: italicFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Try to add the page image
    if (page.imageUrl) {
      try {
        const imageBytes = await fetchImageAsBytes(page.imageUrl);

        if (imageBytes) {
          let image;
          try {
            // First try as JPG
            image = await pdfDoc.embedJpg(imageBytes);
          } catch (jpgError) {
            logPdfOperation(
              `Error embedding page ${i + 1} as JPG, trying as PNG`,
              jpgError
            );
            try {
              // If that fails, try as PNG
              image = await pdfDoc.embedPng(imageBytes);
            } catch (pngError) {
              throw new Error(
                `Failed to embed page ${i + 1} image as JPG or PNG: ${pngError}`
              );
            }
          }

          const imgDims = image.scale(0.5); // Scale down the image

          // Calculate dimensions to fit within content area while maintaining aspect ratio
          let imgWidth = contentWidth;
          let imgHeight = (imgDims.height / imgDims.width) * imgWidth;

          // If height is too large, scale based on height instead
          if (imgHeight > contentHeight * 0.6) {
            imgHeight = contentHeight * 0.6;
            imgWidth = (imgDims.width / imgDims.height) * imgHeight;
          }

          // Center the image horizontally
          const imgX = margin + (contentWidth - imgWidth) / 2;

          pdfPage.drawImage(image, {
            x: imgX,
            y: pageHeight - margin - imgHeight - 30,
            width: imgWidth,
            height: imgHeight,
          });
          console.log(`✅ Successfully added image for page ${i + 1} to PDF`);
        } else {
          pdfPage.drawText(`Image Not Available for Page ${i + 1}`, {
            x: margin + contentWidth / 2 - 120,
            y: pageHeight - margin - 100,
            size: 14,
            font: italicFont,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      } catch (error) {
        logPdfOperation(`Error embedding image for page ${i + 1}`, error);
        pdfPage.drawText(
          `Error loading image for page ${i + 1}: ${error.message}`,
          {
            x: margin + contentWidth / 2 - 150,
            y: pageHeight - margin - 100,
            size: 14,
            font: italicFont,
            color: rgb(0.5, 0.5, 0.5),
          }
        );
      }
    }

    // Add the text content
    const sanitizedText = sanitizeTextForPdf(page.text);

    pdfPage.drawText(sanitizedText, {
      x: margin,
      y: margin + 200,
      size: 12,
      font: regularFont,
      color: rgb(0.1, 0.1, 0.1),
      lineHeight: 16,
      maxWidth: contentWidth,
    });
  }

  logPdfOperation("PDF generation complete");
  return await pdfDoc.save();
}
