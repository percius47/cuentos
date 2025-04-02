import { useEffect, useState } from "react";

interface LoadingStateProps {
  currentStage?: string;
}

export default function LoadingState({ currentStage }: LoadingStateProps) {
  const [dots, setDots] = useState("");
  const [stageMessages, setStageMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState(
    "Starting your storybook generation"
  );

  // Animation for the loading dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Update messages based on current stage
  useEffect(() => {
    if (!currentStage) return;

    // Add the new stage message if it doesn't already exist
    setStageMessages((prev) => {
      if (!prev.includes(currentStage)) {
        return [...prev, currentStage];
      }
      return prev;
    });

    // Set the current message
    setCurrentMessage(currentStage);
  }, [currentStage]);

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 mt-8 text-center">
      <div className="animate-pulse flex flex-col items-center space-y-6">
        <div className="w-24 h-24 bg-indigo-200 dark:bg-indigo-700 rounded-full flex items-center justify-center">
          <span className="text-4xl">📚</span>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Creating Your Storybook
        </h2>

        <div className="space-y-3 w-full">
          <div className="flex space-x-2 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {currentMessage}
            {dots}
          </p>
        </div>

        {stageMessages.length > 0 && (
          <div className="w-full max-w-md p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Progress:
            </h3>
            <ul className="space-y-2 text-left">
              {stageMessages.map((message, index) => (
                <li key={index} className="flex items-center text-sm">
                  <span className="mr-2 text-green-500">✓</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {message}
                  </span>
                </li>
              ))}
              {currentStage &&
                currentStage === stageMessages[stageMessages.length - 1] && (
                  <li className="flex items-center text-sm">
                    <span className="mr-2 text-indigo-500 animate-spin">⟳</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {currentMessage}
                      {dots}
                    </span>
                  </li>
                )}
            </ul>
          </div>
        )}

        <div className="space-y-2 w-full">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
