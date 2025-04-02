"use client";

import React, { useState } from "react";
import Header from "./components/Header";
import StoryForm, { StoryFormData } from "./components/StoryForm";
import LoadingState from "./components/LoadingState";
import StoryPreview from "./components/StoryPreview";
import { generateStory } from "./utils/api";
import { generatePDF } from "./utils/pdfGenerator";
import Loader from "./components/Loader";

export default function Home() {
  const [storyData, setStoryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStory = async (formData: StoryFormData) => {
    setLoading(true);
    setError(null);

    try {
      console.log("Generating story with data:", formData);

      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate story");
      }

      const data = await response.json();
      console.log("API Response:", data);

      setStoryData(data);
    } catch (err: any) {
      console.error("Error generating story:", err);
      setError(
        err.message || "Failed to generate your story. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!storyData) return;

    try {
      setLoading(true);
      setError(null);

      console.log("Preparing your PDF download");

      // Create a sanitized folder name from the story title
      const folderName = storyData.title
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toLowerCase();

      // Save a copy of the PDF to the story folder
      console.log(`Saving PDF to story folder: ${folderName}`);
      try {
        // Request to save the PDF on the server
        const saveResponse = await fetch("/api/save-story", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            storyTitle: storyData.title,
            pages: storyData.pages,
          }),
        });

        if (!saveResponse.ok) {
          console.error(
            "Error saving story locally:",
            await saveResponse.text()
          );
        } else {
          console.log("Story saved successfully");
        }
      } catch (saveError) {
        console.error("Error during save operation:", saveError);
      }

      // Generate PDF for download
      const pdfBytes = await generatePDF(storyData);

      console.log("Creating downloadable file");
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${storyData.title.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setLoading(false);
    } catch (err: any) {
      console.error("Error downloading PDF:", err);
      setError(err.message || "Failed to download your PDF. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-4">
              Create Magical Storybooks for Children
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Personalized AI-generated stories and illustrations tailored to
              your child's interests. Fill out the form below to create a unique
              storybook!
            </p>
          </div>

          {!storyData && !loading && (
            <StoryForm onSubmit={generateStory} isLoading={loading} />
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader />
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                Creating your personalized storybook...
              </p>
            </div>
          )}

          {error && (
            <div className="max-w-md mx-auto mt-8 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
              <h3 className="font-semibold mb-2">Error</h3>
              <p>{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Dismiss
              </button>
            </div>
          )}

          {storyData && !loading && (
            <StoryPreview story={storyData} onDownload={handleDownloadPDF} />
          )}
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow-inner py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© 2024 Cuentos - AI Powered Storybooks for Children</p>
          <p className="mt-2">Created with Next.js, Tailwind CSS, and OpenAI</p>
        </div>
      </footer>
    </div>
  );
}
