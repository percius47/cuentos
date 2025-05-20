"use client";

import { useState, useEffect } from "react";
import PageRefiner from "./PageRefiner";
import { jsPDF } from "jspdf";
import Image from "next/image";

// Add global styles for the font
const fontStyles = `
  @font-face {
    font-family: 'LexendDeca';
    src: url('/LexendDeca-Medium.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
`;

export default function StoryViewer({ storyData }) {
  const [currentBook, setCurrentBook] = useState(storyData);
  const [refiningPage, setRefiningPage] = useState(null); // null or { pageIndex, pageData }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showFullStory, setShowFullStory] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Apply font styles once when component loads
  useEffect(() => {
    // Check if the style already exists to avoid duplicates
    if (!document.getElementById("lexend-font-styles")) {
      const style = document.createElement("style");
      style.id = "lexend-font-styles";
      style.innerHTML = fontStyles;
      document.head.appendChild(style);
    }
  }, []);

  // Calculate all pages including cover + story pages
  const allPages = [
    {
      pageType: "cover",
      imageUrl: currentBook.coverImage,
      title: currentBook.title,
    },
    ...currentBook.pageImages.map((imageUrl, index) => ({
      pageType: "story",
      pageIndex: index,
      imageUrl,
      pageData: currentBook.pages[index],
    })),
  ];

  const handleRefineClick = (pageIndex) => {
    if (pageIndex === -1) {
      // Cover page
      setRefiningPage({
        pageType: "cover",
        pageIndex: -1,
        imageUrl: currentBook.coverImage,
        title: currentBook.title,
        description: currentBook.coverDescription,
      });
    } else {
      // Story page
      const pageData = currentBook.pages[pageIndex];
      setRefiningPage({
        pageType: "story",
        pageIndex,
        imageUrl: currentBook.pageImages[pageIndex],
        pageData,
      });
    }
  };

  const handleRegenerateImage = async (pageIndex, feedback) => {
    setLoading(true);
    setError(null);

    try {
      // Determine if we're regenerating cover or a story page
      const isCover = pageIndex === -1;

      const endpoint = "/api/image/regenerate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: currentBook.id,
          pageIndex: isCover ? "cover" : pageIndex,
          feedback: feedback,
          title: currentBook.title,
          coverDescription: isCover ? currentBook.coverDescription : null,
          pageData: !isCover ? currentBook.pages[pageIndex] : null,
          illustrationStyle: currentBook.illustrationStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate image");
      }

      const regeneratedData = await response.json();

      // Update the book with the regenerated image
      setCurrentBook((prevBook) => {
        const updatedBook = { ...prevBook };

        if (isCover) {
          updatedBook.coverImage = regeneratedData.imageUrl;
        } else {
          const updatedPageImages = [...prevBook.pageImages];
          updatedPageImages[pageIndex] = regeneratedData.imageUrl;
          updatedBook.pageImages = updatedPageImages;
        }

        return updatedBook;
      });

      // Close the refiner
      setRefiningPage(null);
    } catch (err) {
      console.error("Error regenerating image:", err);
      setError(err.message || "Failed to regenerate image");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRefine = () => {
    setRefiningPage(null);
  };

  // Handle purchase button click
  const handlePurchase = () => {
    setPurchaseLoading(true);

    // Simulate a 4-second loading time before showing full story
    setTimeout(() => {
      setPurchaseLoading(false);
      setShowFullStory(true);
    }, 4000);
  };

  // Function to download the storybook as PDF
  const handleDownloadPDF = async () => {
    try {
      setDownloadingPdf(true);

      // Create a new PDF document
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [595.28, 841.89], // A4 size in pixels
      });

      // Load the Lexend Deca font file
      let useLexendFont = false;
      try {
        // Get the font file
        const fontResponse = await fetch("/LexendDeca-Medium.ttf");
        if (!fontResponse.ok) {
          throw new Error("Failed to load font file");
        }

        const fontArrayBuffer = await fontResponse.arrayBuffer();

        // Convert array buffer to base64
        const base64Font = arrayBufferToBase64(fontArrayBuffer);

        // Register the font to the PDF document
        const fontName = "LexendDeca"; // Use consistent name
        pdf.addFileToVFS(`${fontName}.ttf`, base64Font);
        pdf.addFont(`${fontName}.ttf`, fontName, "normal");

        // Try to set the font - if it works, we'll use it throughout
        pdf.setFont(fontName);
        useLexendFont = true;
        console.log("Lexend Deca font loaded and applied successfully");
      } catch (fontError) {
        console.error("Error loading or applying custom font:", fontError);
        console.log("Falling back to helvetica font");
        // Ensure we have a fallback
        pdf.setFont("helvetica");
      }

      // Helper function to convert ArrayBuffer to base64 string
      function arrayBufferToBase64(buffer) {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      }

      // Helper function to load an image
      const loadImage = (url) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "Anonymous"; // Handle CORS issues
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = url;
        });
      };

      // Helper function to determine appropriate background color based on image content
      const getAppropriateBackgroundColor = (img) => {
        // Create a temporary canvas to analyze the image
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Sample key areas of the image to determine dominant colors
        // We'll sample the center and four corners
        const samplePoints = [
          // Center
          { x: Math.floor(img.width / 2), y: Math.floor(img.height / 2) },
          // Top-left
          { x: Math.floor(img.width * 0.25), y: Math.floor(img.height * 0.25) },
          // Top-right
          { x: Math.floor(img.width * 0.75), y: Math.floor(img.height * 0.25) },
          // Bottom-left
          { x: Math.floor(img.width * 0.25), y: Math.floor(img.height * 0.75) },
          // Bottom-right
          { x: Math.floor(img.width * 0.75), y: Math.floor(img.height * 0.75) },
        ];

        // Get pixel data from each sample point
        const samples = samplePoints.map((point) => {
          const pixelData = ctx.getImageData(point.x, point.y, 1, 1).data;
          return {
            r: pixelData[0],
            g: pixelData[1],
            b: pixelData[2],
          };
        });

        // Calculate average color
        const avgColor = samples.reduce(
          (acc, curr) => {
            return {
              r: acc.r + curr.r,
              g: acc.g + curr.g,
              b: acc.b + curr.b,
            };
          },
          { r: 0, g: 0, b: 0 }
        );

        avgColor.r = Math.floor(avgColor.r / samples.length);
        avgColor.g = Math.floor(avgColor.g / samples.length);
        avgColor.b = Math.floor(avgColor.b / samples.length);

        // Determine dominant color component
        const max = Math.max(avgColor.r, avgColor.g, avgColor.b);

        // Create a pastel version based on dominant color
        let pastelColor;

        // Check for specific scene types
        // Green dominant - likely nature/playground
        if (avgColor.g > avgColor.r && avgColor.g > avgColor.b) {
          pastelColor = "#E6FFE6"; // Light green
        }
        // Blue dominant - likely sky/water
        else if (avgColor.b > avgColor.r && avgColor.b > avgColor.g) {
          pastelColor = "#E6F9FF"; // Light blue
        }
        // Red/warm dominant - likely indoor/cozy scene
        else if (avgColor.r > avgColor.b) {
          pastelColor = "#FFE6E6"; // Light pink/rose
        }
        // Yellow/brown dominant - likely beach/desert
        else if (avgColor.r > 150 && avgColor.g > 150 && avgColor.b < 150) {
          pastelColor = "#FFF9E6"; // Light yellow
        }
        // Purple/violet scenes
        else if (avgColor.r > 100 && avgColor.b > 150) {
          pastelColor = "#F9E6FF"; // Light purple
        }
        // Default to a neutral pastel
        else {
          pastelColor = "#F2E6FF"; // Light lavender
        }

        return pastelColor;
      };

      // Add title page
      pdf.setFillColor("#FFE6E6"); // Light pink for title page
      pdf.rect(
        0,
        0,
        pdf.internal.pageSize.getWidth(),
        pdf.internal.pageSize.getHeight(),
        "F"
      );

      pdf.setFontSize(30);
      pdf.setTextColor("#3e253d"); // Dark purple

      if (useLexendFont) {
        pdf.setFont("LexendDeca");
      } else {
        pdf.setFont("helvetica", "bold");
      }

      pdf.text(currentBook.title, pdf.internal.pageSize.getWidth() / 2, 60, {
        align: "center",
      });

      // Add subtitle
      if (useLexendFont) {
        pdf.setFont("LexendDeca");
      } else {
        pdf.setFont("helvetica", "normal");
      }

      // Add images with one per page
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];

        if (i > 0) {
          pdf.addPage();
        }

        try {
          // Load and add image
          const img = await loadImage(page.imageUrl);

          if (i > 0) {
            // Get appropriate background color based on image content
            const backgroundColor = getAppropriateBackgroundColor(img);
            pdf.setFillColor(backgroundColor);
            pdf.rect(
              0,
              0,
              pdf.internal.pageSize.getWidth(),
              pdf.internal.pageSize.getHeight(),
              "F"
            );
          }

          // Calculate dimensions to fit on page with some margin
          const margin = 40;
          const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;

          // Special handling for cover image - make it larger and position it lower
          if (i === 0) {
            // Cover page - allocate 75% of the page height to the image
            const maxHeight = pdf.internal.pageSize.getHeight() * 0.75 - margin;

            // Calculate aspect ratio
            const imgRatio = img.width / img.height;
            let width = maxWidth;
            let height = width / imgRatio;

            if (height > maxHeight) {
              height = maxHeight;
              width = height * imgRatio;
            }

            // Calculate centering position - position lower down on the page
            const x = (pdf.internal.pageSize.getWidth() - width) / 2;
            const y = 100; // Position lower down on the cover page

            // Add image to PDF
            pdf.addImage(img, "JPEG", x, y, width, height);

            // Add "Made with Love, By Cuentos" below the image
            if (useLexendFont) {
              pdf.setFont("LexendDeca");
            } else {
              pdf.setFont("helvetica", "italic");
            }

            pdf.setFontSize(24);
            pdf.setTextColor("#3e253d"); // Dark purple

            // First line: "Made with Love,"
            pdf.text(
              "Made with Love,",
              pdf.internal.pageSize.getWidth() / 2,
              y + height + 40,
              { align: "center" }
            );
            pdf.setFontSize(30);
            // Second line: "By Cuentos"
            pdf.text(
              "By Cuentos.",
              pdf.internal.pageSize.getWidth() / 2,
              y + height + 70,
              { align: "center" }
            );
          } else {
            // Regular story page - allocate 60% of the page height to the image
            const maxHeight = pdf.internal.pageSize.getHeight() * 0.6 - margin;

            // Calculate aspect ratio
            const imgRatio = img.width / img.height;
            let width = maxWidth;
            let height = width / imgRatio;

            if (height > maxHeight) {
              height = maxHeight;
              width = height * imgRatio;
            }

            // Calculate centering position
            const x = (pdf.internal.pageSize.getWidth() - width) / 2;
            const y = margin; // Position at the top with margin

            // Add image to PDF
            pdf.addImage(img, "JPEG", x, y, width, height);

            // Add page text below the image if it's a story page (not cover)
            if (page.pageType === "story" && page.pageData?.content) {
              // Add more space between image and text (40px)
              const textY = y + height + 60;

              // Set font for story text
              if (useLexendFont) {
                pdf.setFont("LexendDeca");
              } else {
                pdf.setFont("helvetica", "normal");
              }

              pdf.setFontSize(36); // 36pt font size
              pdf.setTextColor("#3e253d"); // Dark purple

              // Set letter spacing by splitting the content into characters with additional space
              const content = page.pageData.content;

              // Split text into lines to fit width
              const splitText = pdf.splitTextToSize(
                content,
                maxWidth - 40 // Reduce width slightly to accommodate letter spacing
              );

              // Left-aligned text (x position is left margin)
              pdf.text(splitText, margin + 20, textY, {
                align: "left",
                charSpace: 0.5, // Add letter spacing for better readability
              });

              // Add page number at bottom center
              pdf.setFontSize(14);
              pdf.text(
                i.toString(), // Page number (cover is page 0)
                pdf.internal.pageSize.getWidth() / 2,
                pdf.internal.pageSize.getHeight() - 20,
                { align: "center" }
              );
            }
          }
        } catch (err) {
          console.error(`Failed to add page ${i} to PDF:`, err);
        }
      }

      // Save the PDF
      pdf.save(`${currentBook.title.replace(/\s+/g, "_")}.pdf`);
      setDownloadingPdf(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Failed to generate PDF. Please try again.");
      setDownloadingPdf(false);
    }
  };

  // Styles
  const containerStyle = {
    maxWidth: "800px",
    margin: "0 auto",
  };

  const headerStyle = {
    textAlign: "center",
    marginBottom: "2rem",
  };

  const titleStyle = {
    fontSize: "2rem",
    color: "#3e253d",
    marginBottom: "0.5rem",
  };

  const subtitleStyle = {
    fontSize: "1.125rem",
    color: "#c68e77",
    marginBottom: "1rem",
  };

  const pageContainerStyle = {
    marginBottom: "3rem",
  };

  const pageHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  };

  const pageTitleStyle = {
    fontSize: "1.25rem",
    color: "#3682a2",
    fontWeight: "600",
  };

  const refineButtonStyle = {
    backgroundColor: "#f6aa1d",
    color: "#3e253d",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.875rem",
  };

  const imageContainerStyle = {
    borderRadius: "0.5rem",
    overflow: "hidden",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    border: "2px solid #3e253d",
  };

  const imageStyle = {
    width: "100%",
    height: "auto",
    display: "block",
  };

  const userInputsStyle = {
    backgroundColor: "#3e253d",
    padding: "1.5rem",
    borderRadius: "0.5rem",
    marginBottom: "2rem",
  };

  const userInputLabelStyle = {
    fontSize: "0.875rem",
    color: "#f6aa1d",
    marginBottom: "0.25rem",
  };

  const userInputValueStyle = {
    fontSize: "1rem",
    color: "#ffe2b9",
    marginBottom: "0.75rem",
  };

  const loadingOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(62, 37, 61, 0.8)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  };

  const errorStyle = {
    backgroundColor: "rgba(198, 142, 119, 0.3)",
    border: "1px solid #c68e77",
    color: "#3e253d",
    padding: "1rem",
    borderRadius: "0.375rem",
    marginBottom: "1.5rem",
  };

  const headerButtonsStyle = {
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
    marginTop: "1rem",
  };

  const downloadButtonStyle = {
    backgroundColor: "#3682a2", // Teal blue
    color: "#ffe2b9", // Light beige
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.375rem",
    fontWeight: "600",
    fontSize: "1rem",
    cursor: downloadingPdf ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  };

  const purchaseButtonStyle = {
    backgroundColor: "#f6aa1d", // Amber
    color: "#3e253d", // Dark purple
    border: "none",
    padding: "1rem 2rem",
    borderRadius: "0.5rem",
    fontWeight: "bold",
    fontSize: "1.25rem",
    cursor: purchaseLoading ? "not-allowed" : "pointer",
    display: "block",
    margin: "2rem auto",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    transition: "all 0.2s ease",
  };

  const purchaseContainerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2rem",
    margin: "2rem 0",
    backgroundColor: "#ffe2b9",
    border: "2px dashed #3e253d",
    borderRadius: "0.5rem",
    textAlign: "center",
  };

  return (
    <div style={containerStyle}>
      {loading && (
        <div style={loadingOverlayStyle}>
          <div style={{ color: "white", textAlign: "center" }}>
            <div style={{ marginBottom: "1rem" }}>
              <svg
                style={{
                  animation: "spin 1s linear infinite",
                  height: "3rem",
                  width: "3rem",
                  margin: "0 auto",
                }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  style={{ opacity: "0.25" }}
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  style={{ opacity: "0.75" }}
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <p>Regenerating image...</p>
          </div>
        </div>
      )}

      {purchaseLoading && (
        <div style={loadingOverlayStyle}>
          <div style={{ color: "white", textAlign: "center" }}>
            <div style={{ marginBottom: "1rem" }}>
              <svg
                style={{
                  animation: "spin 1s linear infinite",
                  height: "3rem",
                  width: "3rem",
                  margin: "0 auto",
                }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  style={{ opacity: "0.25" }}
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  style={{ opacity: "0.75" }}
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <p>Processing your purchase...</p>
          </div>
        </div>
      )}

      {downloadingPdf && (
        <div style={loadingOverlayStyle}>
          <div style={{ color: "white", textAlign: "center" }}>
            <div style={{ marginBottom: "1rem" }}>
              <svg
                style={{
                  animation: "spin 1s linear infinite",
                  height: "3rem",
                  width: "3rem",
                  margin: "0 auto",
                }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  style={{ opacity: "0.25" }}
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  style={{ opacity: "0.75" }}
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <p>Creating PDF...</p>
          </div>
        </div>
      )}

      {refiningPage ? (
        <PageRefiner
          pageData={refiningPage}
          onRegenerate={(feedback) =>
            handleRegenerateImage(refiningPage.pageIndex, feedback)
          }
          onCancel={handleCancelRefine}
          loading={loading}
        />
      ) : (
        <>
          <div style={headerStyle}>
            <h1 style={titleStyle}>{currentBook.title}</h1>
            <p style={subtitleStyle}>Your personalized storybook</p>

            {showFullStory && (
              <div style={headerButtonsStyle}>
                <button
                  onClick={handleDownloadPDF}
                  style={downloadButtonStyle}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <>
                      <svg
                        style={{
                          animation: "spin 1s linear infinite",
                          height: "1.25rem",
                          width: "1.25rem",
                        }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          style={{ opacity: "0.25" }}
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          style={{ opacity: "0.75" }}
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Creating PDF...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Download PDF
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div style={userInputsStyle}>
            <h3 style={{ ...pageTitleStyle, marginBottom: "1rem" }}>
              Story Parameters
            </h3>

            <div>
              <p style={userInputLabelStyle}>Child's Name</p>
              <p style={userInputValueStyle}>{currentBook.childName}</p>
            </div>

            <div>
              <p style={userInputLabelStyle}>Reading Level</p>
              <p style={userInputValueStyle}>{currentBook.readingLevel}</p>
            </div>

            <div>
              <p style={userInputLabelStyle}>Language</p>
              <p style={userInputValueStyle}>
                {currentBook.language === "spanish" ? "Spanish" : "English"}
              </p>
            </div>

            <div>
              <p style={userInputLabelStyle}>Theme</p>
              <p style={userInputValueStyle}>{currentBook.theme}</p>
            </div>

            <div>
              <p style={userInputLabelStyle}>Illustration Style</p>
              <p style={userInputValueStyle}>{currentBook.illustrationStyle}</p>
            </div>

            {currentBook.customPrompt && (
              <div>
                <p style={userInputLabelStyle}>Custom Prompt</p>
                <p style={userInputValueStyle}>{currentBook.customPrompt}</p>
              </div>
            )}
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          {/* Cover Page */}
          <div style={pageContainerStyle}>
            <div style={pageHeaderStyle}>
              <h2 style={pageTitleStyle}>Cover</h2>
              <button
                onClick={() => handleRefineClick(-1)}
                style={refineButtonStyle}
              >
                Refine Page
              </button>
            </div>
            <div style={imageContainerStyle}>
              <Image
                src={currentBook.coverImage}
                alt="Cover"
                width={300}
                height={400}
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>

          {/* First Page Only when not showing full story */}
          {!showFullStory && currentBook.pageImages.length > 0 && (
            <div style={pageContainerStyle}>
              <div style={pageHeaderStyle}>
                <h2 style={pageTitleStyle}>Page 1</h2>
                <button
                  onClick={() => handleRefineClick(0)}
                  style={refineButtonStyle}
                >
                  Refine Page
                </button>
              </div>
              <div style={imageContainerStyle}>
                <Image
                  src={currentBook.pageImages[0]}
                  alt="Page 1"
                  width={300}
                  height={400}
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div style={{ marginTop: "1rem", color: "#3e253d" }}>
                <p>{currentBook.pages[0]?.content}</p>
              </div>
            </div>
          )}

          {/* Purchase Button when not showing full story */}
          {!showFullStory && (
            <div style={purchaseContainerStyle}>
              <h2 style={{ color: "#3e253d", marginBottom: "1rem" }}>
                Want to read the full story?
              </h2>
              <p style={{ color: "#3e253d", marginBottom: "1.5rem" }}>
                Purchase now to unlock all {currentBook.pageImages.length} pages
                of "{currentBook.title}"
              </p>
              <button
                onClick={handlePurchase}
                style={purchaseButtonStyle}
                disabled={purchaseLoading}
              >
                Purchase Full Story
              </button>
            </div>
          )}

          {/* Remaining Pages when showing full story */}
          {showFullStory &&
            currentBook.pageImages.map((imageUrl, index) => (
              <div key={index} style={pageContainerStyle}>
                <div style={pageHeaderStyle}>
                  <h2 style={pageTitleStyle}>Page {index + 1}</h2>
                  <button
                    onClick={() => handleRefineClick(index)}
                    style={refineButtonStyle}
                  >
                    Refine Page
                  </button>
                </div>
                <div style={imageContainerStyle}>
                  <Image
                    src={imageUrl}
                    alt={`Page ${index + 1}: ${
                      currentBook.pages[index]?.content || ""
                    }`}
                    width={300}
                    height={400}
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div style={{ marginTop: "1rem", color: "#3e253d" }}>
                  <p>{currentBook.pages[index]?.content}</p>
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
