/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["cuentos22.s3.ap-south-1.amazonaws.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cuentos22.s3.ap-south-1.amazonaws.com",
        port: "",
        pathname: "/stories/**",
      },
    ],
  },
};

module.exports = nextConfig;
