/** @type {import('next').NextConfig} */
module.exports = {
    output: "export", // Bruker statisk eksport
    images: {
      unoptimized: true // Fjerner Next.js' innebygde bildeoptimalisering
    }
  };
  