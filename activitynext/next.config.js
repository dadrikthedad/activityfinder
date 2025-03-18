/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      domains: ["activityvercel.vercel.app"], // Tillater eksterne bilder fra din Vercel-app
    },
    reactStrictMode: true, // Anbefalt for å fange opp feil i utvikling
  };
  
  module.exports = nextConfig;
  
  