"use client";

import { usePathname } from "next/navigation";

/** Mostra o conteúdo só fora do painel (/admin): o cabeçalho e o rodapé do site somem lá dentro. */
export function ForaDoPainel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}
