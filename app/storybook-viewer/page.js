"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StoryViewer from "../components/StoryViewer";

export default function StorybookViewerPage() {
  const searchParams = useSearchParams();
  const [storyData, setStoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storyId = searchParams.get("id");
    if (!storyId) {
      setError("No story ID provided");
      setLoading(false);
      return;
    }

    // Try to load the story from localStorage
    try {
      const savedStory = localStorage.getItem(`story_${storyId}`);
      if (savedStory) {
        setStoryData(JSON.parse(savedStory));
      } else {
        setError("Story not found");
      }
    } catch (err) {
      console.error("Error loading story:", err);
      setError("Failed to load story");
    }

    setLoading(false);
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffe2b9", // Light beige
        color: "#3e253d", // Dark purple
        display: "flex",
        flexDirection: "column",
        paddingBottom: "2rem",
      }}
    >
      <nav
        style={{
          backgroundColor: "#3682a2", // Teal blue
          padding: "1rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ffe2b9" }}
          >
            Cuentos
          </h1>
          <a
            href="/"
            style={{
              color: "#ffe2b9", // Light beige
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              fontSize: "0.875rem",
            }}
          >
            ← Back to home
          </a>
        </div>
      </nav>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1rem" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "3rem 0",
            }}
          >
            <div style={{ textAlign: "center", color: "#3e253d" }}>
              <p>Loading story...</p>
            </div>
          </div>
        ) : error ? (
          <div
            style={{
              backgroundColor: "rgba(198, 142, 119, 0.3)", // Terra cotta with opacity
              border: "1px solid #c68e77", // Terra cotta
              color: "#3e253d", // Dark purple
              padding: "1rem",
              borderRadius: "0.5rem",
              textAlign: "center",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                color: "#3e253d", // Dark purple
                marginBottom: "0.5rem",
              }}
            >
              Error
            </h2>
            <p>{error}</p>
            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: "1rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#f6aa1d", // Amber
                color: "#3e253d", // Dark purple
                borderRadius: "0.375rem",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              Return to Home Page
            </a>
          </div>
        ) : (
          storyData && <StoryViewer storyData={storyData} />
        )}
      </main>
    </div>
  );
}
