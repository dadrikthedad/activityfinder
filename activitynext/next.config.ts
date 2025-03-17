import { NextConfig } from "next";

const nextConfig = {
  output: "export", // Kreves for Azure Static Web Apps
  images: {
    unoptimized: true, // Fjerner Next.js' innebygde image-optimalisering
  },
};

export default nextConfig;
