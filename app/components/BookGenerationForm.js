"use client";

import { useState } from "react";
import LoadingScreen from "./LoadingScreen";

export default function BookGenerationForm() {
  const [formData, setFormData] = useState({
    childName: "",
    age: "4-7",
    theme: "moral-values",
    illustrationStyle: "pixar-style",
    customPrompt: "",
    language: "spanish",
  });
  const [loading, setLoading] = useState(false);
  const [generatedBook, setGeneratedBook] = useState(null);
  const [error, setError] = useState(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");

  const themes = [
    {
      id: "moral-values",
      name: "Moral Values",
      description:
        "Stories that help children learn important virtues like honesty, kindness, respect, and responsibility through engaging narratives with age-appropriate moral dilemmas.",
    },
    {
      id: "social-education",
      name: "Social Skills",
      description:
        "Stories focused on friendship, teamwork, empathy, and conflict resolution that help children develop emotional intelligence and interpersonal skills.",
    },
    {
      id: "knowledge-building",
      name: "Educational Adventure",
      description:
        "Fun adventures that weave interesting facts about science, nature, space, or animals into an engaging story that sparks curiosity and love of learning.",
    },
    {
      id: "fantasy-adventure",
      name: "Fantasy Quest",
      description:
        "Imaginative journeys through magical worlds with fantastical elements that encourage creativity, bravery, and problem-solving skills.",
    },
  ];

  const illustrationStyles = [
    { id: "pixar-style", name: "Pixar Style" },
    { id: "disney-classic", name: "Disney Classic" },
    { id: "hand-drawn-watercolor", name: "Hand-drawn Watercolor" },
    { id: "cartoon-sketch", name: "Cartoon Sketch" },
    { id: "minimalist-modern", name: "Minimalist Modern" },
  ];

  const ageOptions = [
    { value: "1-4", label: "Toddler (1-4 years)" },
    { value: "4-7", label: "Early reader (4-7 years)" },
    { value: "7-10", label: "Independent reader (7-10 years)" },
  ];

  const languageOptions = [
    { value: "spanish", label: "Spanish" },
    { value: "english", label: "English" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGenerationStep(0);
    setGenerationStatus("Starting story generation...");

    try {
      // Step 1: Generate the story
      setGenerationStatus("Creating your story...");
      const storyResponse = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const storyData = await storyResponse.json();

      if (!storyResponse.ok) {
        throw new Error(storyData.error || "Error generating story");
      }

      setGenerationStep(1);
      setGenerationStatus("Generating character profile...");

      // Step 2: Generate images
      setGenerationStatus("Creating beautiful illustrations...");
      const imageResponse = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: storyData.title,
          coverDescription: storyData.coverDescription,
          pages: storyData.pages,
          illustrationStyle: formData.illustrationStyle,
          mainCharacter: formData.childName,
          theme: formData.theme,
          language: formData.language,
          ageRange: formData.age,
        }),
      });

      const imageData = await imageResponse.json();

      if (!imageResponse.ok) {
        throw new Error(imageData.error || "Error generating images");
      }

      setGenerationStep(2);
      setGenerationStatus("Finalizing your storybook...");

      // Create complete storybook data
      const completeStoryData = {
        id: Date.now().toString(36),
        ...storyData,
        ...formData,
        readingLevel:
          ageOptions.find((opt) => opt.value === formData.age)?.label ||
          formData.age,
        theme:
          themes.find((t) => t.id === formData.theme)?.name || formData.theme,
        illustrationStyle:
          illustrationStyles.find((s) => s.id === formData.illustrationStyle)
            ?.name || formData.illustrationStyle,
        coverImage: imageData.coverImage,
        pageImages: imageData.pageImages,
      };

      // Store the story data in localStorage
      localStorage.setItem(
        `story_${completeStoryData.id}`,
        JSON.stringify(completeStoryData)
      );

      setGenerationStep(3);
      setGenerationStatus("Your storybook is ready!");

      // Navigate to the storybook viewer page
      window.location.href = `/storybook-viewer?id=${completeStoryData.id}`;

      // For demonstration purposes, still set the generatedBook state
      setGeneratedBook({
        ...storyData,
        coverImage: imageData.coverImage,
        pageImages: imageData.pageImages,
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formContainerStyle = {
    backgroundColor: "#3e253d",
    padding: "2rem",
    borderRadius: "0.5rem",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
    border: "1px solid #5e3a5d",
    maxWidth: "600px",
    margin: "0 auto",
  };

  const headingStyle = {
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1.5rem",
    textAlign: "center",
    color: "#ffe2b9",
  };

  const errorStyle = {
    backgroundColor: "rgba(198, 142, 119, 0.3)",
    border: "1px solid #c68e77",
    color: "#ffe2b9",
    padding: "0.75rem 1rem",
    borderRadius: "0.375rem",
    marginBottom: "1.5rem",
  };

  const formGroupStyle = {
    marginBottom: "1.5rem",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "500px",
  };

  const labelStyle = {
    display: "block",
    color: "#ffe2b9",
    marginBottom: "0.5rem",
    fontWeight: "500",
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#2e1c2d",
    border: "1px solid #5e3a5d",
    borderRadius: "0.375rem",
    color: "#ffe2b9",
    outline: "none",
    fontSize: "1rem",
  };

  const buttonStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "0.375rem",
    color: "#3e253d",
    fontWeight: "600",
    transition: "background-color 0.2s",
    backgroundColor: loading ? "#c68e77" : "#f6aa1d",
    cursor: loading ? "not-allowed" : "pointer",
    fontSize: "1rem",
    border: "none",
    marginTop: "0.5rem",
  };

  const noteStyle = {
    fontSize: "0.875rem",
    color: "#ffe2b9",
    marginTop: "0.5rem",
    marginBottom: "1rem",
    fontStyle: "italic",
    padding: "0.75rem",
    backgroundColor: "rgba(54, 130, 162, 0.2)",
    borderRadius: "0.375rem",
    textAlign: "center",
  };

  const cardStyle = {
    marginBottom: "2rem",
  };

  const cardTitleStyle = {
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1rem",
    color: "#a5b4fc",
  };

  const imageContainerStyle = {
    overflow: "hidden",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  };

  const dividerStyle = {
    borderTop: "1px solid #374151",
    paddingTop: "1.5rem",
    marginTop: "1.5rem",
  };

  const paymentCardStyle = {
    marginTop: "2rem",
    textAlign: "center",
    backgroundColor: "#3682a2",
    padding: "1.5rem",
    borderRadius: "0.5rem",
  };

  const purchaseButtonStyle = {
    backgroundColor: "#f6aa1d",
    padding: "0.75rem 2rem",
    color: "#3e253d",
    fontWeight: "600",
    borderRadius: "0.375rem",
    border: "none",
    cursor: "pointer",
  };

  const resetButtonStyle = {
    width: "100%",
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#c68e77",
    color: "#ffe2b9",
    borderRadius: "0.375rem",
    border: "none",
    cursor: "pointer",
  };

  const formStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    width: "100%",
    alignItems: "center",
  };

  const nameInputStyle = {
    ...inputStyle,
    maxWidth: "280px",
  };

  const customPromptContainerStyle = {
    ...formGroupStyle,
    width: "100%",
    maxWidth: "500px",
  };

  const customPromptStyle = {
    ...inputStyle,
    minHeight: "100px",
    resize: "vertical",
    width: "auto",
  };

  const buttonContainerStyle = {
    width: "100%",
    maxWidth: "500px",
    marginTop: "0.5rem",
  };

  const noteContainerStyle = {
    width: "100%",
    maxWidth: "500px",
  };

  return (
    <div style={formContainerStyle}>
      {loading && (
        <LoadingScreen
          totalSteps={3}
          currentStep={generationStep}
          status={generationStatus}
        />
      )}

      <h2 style={headingStyle}>Create a Personalized Story</h2>

      {error && <div style={errorStyle}>{error}</div>}

      {!generatedBook ? (
        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Child's Name</label>
            <input
              type="text"
              name="childName"
              value={formData.childName}
              onChange={handleChange}
              required
              style={nameInputStyle}
              placeholder="Enter name"
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Age Range</label>
            <select
              name="age"
              value={formData.age}
              onChange={handleChange}
              style={inputStyle}
            >
              {ageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Language</label>
            <select
              name="language"
              value={formData.language}
              onChange={handleChange}
              style={inputStyle}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Story Theme</label>
            <select
              name="theme"
              value={formData.theme}
              onChange={handleChange}
              style={inputStyle}
            >
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            {formData.theme && (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#94a3b8",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  borderRadius: "0.25rem",
                }}
              >
                {themes.find((t) => t.id === formData.theme)?.description}
              </p>
            )}
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Illustration Style</label>
            <select
              name="illustrationStyle"
              value={formData.illustrationStyle}
              onChange={handleChange}
              style={inputStyle}
            >
              {illustrationStyles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
          </div>

          <div style={customPromptContainerStyle}>
            <label style={labelStyle}>Custom Story Idea (optional)</label>
            <textarea
              name="customPrompt"
              value={formData.customPrompt}
              onChange={handleChange}
              rows="3"
              style={customPromptStyle}
              placeholder="Specific ideas for the story..."
            ></textarea>
          </div>

          <div style={buttonContainerStyle}>
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    style={{
                      animation: "spin 1s linear infinite",
                      marginRight: "0.75rem",
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
                  Generating Story...
                </div>
              ) : (
                "Generate Story"
              )}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>{generatedBook.title}</h3>
            <div style={imageContainerStyle}>
              <img
                src={generatedBook.coverImage}
                alt="Book Cover"
                style={{
                  maxWidth: "100%",
                  margin: "0 auto",
                  borderRadius: "0.5rem",
                }}
              />
            </div>
          </div>

          <div style={dividerStyle}>
            <h4
              style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                marginBottom: "1rem",
                color: "#a5b4fc",
              }}
            >
              First Page Preview:
            </h4>
            <div style={imageContainerStyle}>
              <img
                src={generatedBook.pageImages[0]}
                alt="First Page"
                style={{
                  maxWidth: "100%",
                  margin: "0 auto",
                  borderRadius: "0.5rem",
                }}
              />
            </div>
          </div>

          <div style={paymentCardStyle}>
            <p style={{ color: "#d1d5db", marginBottom: "1.25rem" }}>
              Your storybook has been created!
            </p>
            <div
              style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
            >
              <button
                style={{
                  ...purchaseButtonStyle,
                  backgroundColor: "#4f46e5",
                }}
                onClick={() => {
                  // Navigate to the storybook viewer
                  if (generatedBook && generatedBook.id) {
                    window.location.href = `/storybook-viewer?id=${generatedBook.id}`;
                  }
                }}
              >
                View Full Story
              </button>
              <button style={purchaseButtonStyle}>Purchase Full Story</button>
            </div>
          </div>

          <button
            onClick={() => setGeneratedBook(null)}
            style={resetButtonStyle}
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
