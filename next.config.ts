import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // As capas dos cursos vêm da plataforma da Escola Avançada (domínio ainda a confirmar).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
