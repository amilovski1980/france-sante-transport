import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Le répertoire parent contient un package-lock.json concurrent : on force la
  // racine du workspace sur le projet pour éviter les erreurs de build (/_not-found).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
