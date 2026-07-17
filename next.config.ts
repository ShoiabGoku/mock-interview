import type { NextConfig } from "next";

// Static export for GitHub Pages. If the GitHub repo name changes, update
// REPO_NAME to match — it becomes the basePath at
// https://shoiabgoku.github.io/<REPO_NAME>.
const REPO_NAME = "mock-interview";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? `/${REPO_NAME}` : "",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
