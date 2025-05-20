"use client";

import { useState } from "react";
import Image from "next/image";

export default function PageRefiner({
  pageData,
  onRegenerate,
  onCancel,
  loading,
}) {
  const [feedbackType, setFeedbackType] = useState("text-readability");
  const [feedbackDetails, setFeedbackDetails] = useState("");

  const isCover = pageData.pageType === "cover";

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegenerate({
      type: feedbackType,
      details: feedbackDetails,
    });
  };

  // Styles
  const containerStyle = {
    backgroundColor: "#ffe2b9", // Light beige
    padding: "2rem",
    borderRadius: "0.5rem",
    border: "2px solid #3e253d", // Dark purple
    marginBottom: "2rem",
  };

  const headingStyle = {
    fontSize: "1.5rem",
    color: "#3e253d", // Dark purple
    marginBottom: "1.5rem",
    textAlign: "center",
    fontWeight: "bold",
  };

  const formStyle = {
    display: "flex",
    flexDirection: "column",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "0.5rem",
    color: "#3e253d", // Dark purple
    fontWeight: "500",
  };

  const selectStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "white",
    border: "1px solid #c68e77", // Terra cotta
    borderRadius: "0.375rem",
    color: "#3e253d", // Dark purple
    marginBottom: "1rem",
    fontSize: "1rem",
  };

  const textareaStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "white",
    border: "1px solid #c68e77", // Terra cotta
    borderRadius: "0.375rem",
    color: "#3e253d", // Dark purple
    minHeight: "120px",
    marginBottom: "1.5rem",
    fontSize: "1rem",
    resize: "vertical",
  };

  const buttonGroupStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
  };

  const primaryButtonStyle = {
    flex: 1,
    padding: "0.75rem 1rem",
    backgroundColor: "#3682a2", // Teal blue
    color: "#ffe2b9", // Light beige
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: "600",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
  };

  const secondaryButtonStyle = {
    flex: 1,
    padding: "0.75rem 1rem",
    backgroundColor: "#c68e77", // Terra cotta
    color: "#ffe2b9", // Light beige
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: "600",
    cursor: loading ? "not-allowed" : "pointer",
  };

  const imageStyle = {
    width: "100%",
    borderRadius: "0.375rem",
    marginBottom: "1.5rem",
    border: "1px solid #c68e77", // Terra cotta
  };

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>
        Refine {isCover ? "Cover" : `Page ${pageData.pageIndex + 1}`}
      </h2>

      <Image
        src={pageData.imageUrl}
        alt={isCover ? "Cover" : `Page ${pageData.pageIndex + 1}`}
        width={300}
        height={400}
        style={{ objectFit: "cover" }}
      />

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>What would you like to improve?</label>
        <select
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
          style={selectStyle}
          disabled={loading}
        >
          <option value="text-readability">Text Readability</option>
          <option value="character-appearance">Character Appearance</option>
          <option value="illustration-style">Illustration Style</option>
          <option value="composition">Image Composition</option>
          <option value="color-palette">Color Palette</option>
          <option value="other">Other</option>
        </select>

        <label style={labelStyle}>Specific Feedback</label>
        <textarea
          value={feedbackDetails}
          onChange={(e) => setFeedbackDetails(e.target.value)}
          placeholder="Please describe what you'd like to change..."
          style={textareaStyle}
          disabled={loading}
          required
        />

        <div style={buttonGroupStyle}>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyle}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? "Regenerating..." : "Regenerate Image"}
          </button>
        </div>
      </form>
    </div>
  );
}
