import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@stuffhub/domain"],
  // Tesseract starts its own Node worker from package files at runtime. Bundling
  // it rewrites that path into `.next/worker-script/node/index.js`, which does
  // not exist when the media route handles uploads.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
