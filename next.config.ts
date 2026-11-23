import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Arquivos lidos pelo gerador de PDF do certificado precisam ir junto na publicação.
  outputFileTracingIncludes: {
    "/certificados/[codigo]/pdf": ["./src/assets/fontes/**", "./public/logo-tecpro-transparente.png"],
  },
  images: {
    // As capas dos cursos vêm da plataforma da Escola Avançada (domínio ainda a confirmar).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
