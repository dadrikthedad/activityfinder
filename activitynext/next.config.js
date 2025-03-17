/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export", // 🔥 Kreves for Azure Static Web Apps
    images: {
      unoptimized: true, // 🔥 Fjerner Next.js' innebygde bildeoptimalisering
    },
  };
  
  module.exports = nextConfig;
  