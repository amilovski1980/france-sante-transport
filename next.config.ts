import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Le répertoire parent contient un package-lock.json concurrent : on force la
  // racine du workspace sur le projet pour éviter les erreurs de build (/_not-found).
  outputFileTracingRoot: path.join(__dirname),
  // Le projet a une dette de lint historique (règles React Compiler de
  // eslint-config-next 16). On ne bloque pas le build de production ; le lint
  // reste exécutable séparément avec `npm run lint`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
