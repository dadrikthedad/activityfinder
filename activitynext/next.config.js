/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      unoptimized: true, // Fjerner Next.js' innebygde bildeoptimalisering for Azure
    },
  };
  
  module.exports = nextConfig;
  