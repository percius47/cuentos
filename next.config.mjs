/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Ensure Node.js core modules are treated properly
  // This is needed because we're using fs and path in server components/API routes
  experimental: {
    serverComponentsExternalPackages: ["pdf-lib"],
  },
  webpack: (config, { isServer }) => {
    // Handle Node.js modules properly in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
