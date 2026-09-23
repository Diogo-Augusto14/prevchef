import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Há outro lockfile acima desta pasta; fixamos a raiz para evitar o aviso.
  outputFileTracingRoot: path.join(__dirname),
  // Cada tela aberta pergunta ao servidor, a cada 5 s, se outra gravou. Sem
  // isto o terminal do `next dev` vira uma lista dessas perguntas.
  logging: { incomingRequests: { ignore: [/\/api\/servico\?desde=/] } },
};

export default nextConfig;
