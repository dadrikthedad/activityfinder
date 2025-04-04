/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // Tillater både Vercel-URL og Azure Blob Storage
    domains: ["activityvercel.vercel.app"],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "activitystorage.blob.core.windows.net",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;