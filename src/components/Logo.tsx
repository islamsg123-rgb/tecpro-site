import Image from "next/image";

/**
 * Logo oficial da Tecpro Multi Ensino (arquivo enviado pelo cliente, sem alterações de desenho).
 * Versão com fundo transparente: usar só sobre fundos escuros, porque o "TEC" é branco.
 */
export function Logo({ altura = 44 }: { altura?: number }) {
  const largura = Math.round((altura * 453) / 165);
  return (
    <Image
      src="/logo-tecpro-transparente.png"
      alt="Tecpro Multi Ensino"
      width={largura}
      height={altura}
      priority
    />
  );
}
