import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "oaidalleapiprodscus.blob.core.windows.net", // OpenAI DALL-E image domain
      "placehold.co", // Placeholder images
    ],
    // Use local placeholders during development to save API credits
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oaidalleapiprodscus.blob.core.windows.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
    unoptimized: true, // Disable image optimization for testing
  },
};

export default nextConfig;
