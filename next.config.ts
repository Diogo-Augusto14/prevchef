import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Há outro lockfile acima desta pasta; fixamos a raiz para evitar o aviso.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
