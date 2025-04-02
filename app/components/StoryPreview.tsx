import React from "react";
import Image from "next/image";

interface StoryPreviewProps {
  story: {
    title: string;
    pages: {
      text: string;
      imageUrl: string;
    }[];
  };
  onDownload?: () => void;
}

export default function StoryPreview({ story, onDownload }: StoryPreviewProps) {
  // Extract cover page (first page) and content pages (remaining pages)
  const coverPage = story.pages[0];
  const contentPages = story.pages.slice(1);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      {/* Title and Download Button */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          {story.title}
        </h2>
        {onDownload && (
          <button
            onClick={onDownload}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Download PDF
          </button>
        )}
      </div>

      {/* Cover Page */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
          Cover
        </h3>
        <div className="aspect-[3/4] relative rounded-lg overflow-hidden shadow-md mx-auto max-w-md">
          {coverPage.imageUrl ? (
            <Image
              src={coverPage.imageUrl}
              alt="Story cover"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              className="object-cover"
              unoptimized={coverPage.imageUrl.startsWith("/")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-center px-4">
                Cover image not available
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Story Pages */}
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
          Story Pages
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {contentPages.map((page, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm"
            >
              <div className="aspect-[3/4] relative bg-gray-100 dark:bg-gray-800">
                {page.imageUrl ? (
                  <Image
                    src={page.imageUrl}
                    alt={`Page ${index + 1} illustration`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    unoptimized={page.imageUrl.startsWith("/")}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-center px-4">
                      Image not available
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Page {index + 1}
                </div>
                <p className="text-gray-800 dark:text-gray-200">{page.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
