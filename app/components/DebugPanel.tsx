interface DebugPanelProps {
  debugData: {
    promptsGenerated: number;
    imagesGenerated: number;
    generationTime: string;
    usedFallbackImages: boolean;
    imageGenerationDisabled?: boolean;
    apiKeyStatus: {
      OPENAI_API_KEY_EXISTS: boolean;
      NEXT_PUBLIC_OPENAI_API_KEY_EXISTS: boolean;
    };
  };
}

export default function DebugPanel({ debugData }: DebugPanelProps) {
  return (
    <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
          Debug Information
        </h3>
        <div className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Generation Time: {debugData.generationTime}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="flex items-center">
          <span className="mr-1 font-medium">Prompts Generated:</span>
          <span>{debugData.promptsGenerated}</span>
        </div>
        <div className="flex items-center">
          <span className="mr-1 font-medium">Images Generated:</span>
          <span>
            {debugData.imageGenerationDisabled
              ? "Disabled"
              : debugData.imagesGenerated}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1 text-xs">
        {debugData.imageGenerationDisabled && (
          <div className="flex items-center">
            <div className={`w-3 h-3 mr-2 rounded-full bg-yellow-500`}></div>
            <span>Image Generation: Disabled for testing</span>
          </div>
        )}
        {!debugData.imageGenerationDisabled && (
          <div className="flex items-center">
            <div
              className={`w-3 h-3 mr-2 rounded-full ${
                debugData.usedFallbackImages ? "bg-yellow-500" : "bg-green-500"
              }`}
            ></div>
            <span>
              Image Generation:{" "}
              {debugData.usedFallbackImages
                ? "Some images used fallbacks"
                : "All images generated successfully"}
            </span>
          </div>
        )}
        <div className="flex items-center">
          <div
            className={`w-3 h-3 mr-2 rounded-full ${
              debugData.apiKeyStatus.OPENAI_API_KEY_EXISTS
                ? "bg-green-500"
                : "bg-red-500"
            }`}
          ></div>
          <span>
            Server API Key:{" "}
            {debugData.apiKeyStatus.OPENAI_API_KEY_EXISTS
              ? "Available"
              : "Missing"}
          </span>
        </div>
        <div className="flex items-center">
          <div
            className={`w-3 h-3 mr-2 rounded-full ${
              debugData.apiKeyStatus.NEXT_PUBLIC_OPENAI_API_KEY_EXISTS
                ? "bg-green-500"
                : "bg-red-500"
            }`}
          ></div>
          <span>
            Client API Key:{" "}
            {debugData.apiKeyStatus.NEXT_PUBLIC_OPENAI_API_KEY_EXISTS
              ? "Available"
              : "Missing"}
          </span>
        </div>
      </div>
    </div>
  );
}
