"use client";

/** Nome do evento que faz a bolinha de ajuda abrir a janela (ver JanelaAjuda). */
export const EVENTO_ABRIR_AJUDA = "tecpro:abrir-ajuda";

/** Botão que abre a janela do botão de ajuda, opcionalmente já com o assunto e um texto. */
export function BotaoAbrirAjuda({ tipo, mensagem, className, children }: {
  tipo?: string; mensagem?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_AJUDA, { detail: { tipo, mensagem } }))}
    >
      {children}
    </button>
  );
}
