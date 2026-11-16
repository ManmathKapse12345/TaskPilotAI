import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // keep the dev badge from covering the sidebar profile card
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
