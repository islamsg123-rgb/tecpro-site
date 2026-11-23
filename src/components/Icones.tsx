/** Ícones simples em SVG (traço), para não depender de bibliotecas externas. */
type P = { className?: string };
const base = (d: React.ReactNode) =>
  function Icone({ className = "h-6 w-6" }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        {d}
      </svg>
    );
  };

export const IconeRelogio = base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconePlay = base(<><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5 3.5-5 3.5z" /></>);
export const IconeCertificado = base(<><path d="M4 5h16v10H4z" /><path d="M8 9h8M8 12h5" /><circle cx="16" cy="17" r="2.5" /><path d="m14.5 19-1 3 2.5-1 2.5 1-1-3" /></>);
export const IconeCelular = base(<><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></>);
export const IconeCheck = base(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconeBusca = base(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>);
export const IconeSeta = base(<path d="M5 12h14m-5-5 5 5-5 5" />);
export const IconeChevron = base(<path d="m6 9 6 6 6-6" />);
export const IconeCarrinho = base(<><path d="M3 4h2l2.4 11h10.2L20 8H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>);
export const IconeCadeado = base(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const IconePix = base(<><path d="m12 3 9 9-9 9-9-9z" /><path d="m8 12 4-4 4 4-4 4z" /></>);
export const IconeChapeu = base(<><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /><path d="M22 9v5" /></>);
export const IconeComputador = base(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>);
export const IconeGrafico = base(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const IconePincel = base(<><path d="M18 3 9 12l3 3 9-9z" /><path d="M9 12c-3 0-5 2-5 5 0 1.5-1 2.5-2 3 4 1 9 0 10-5" /></>);
export const IconeCodigo = base(<><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>);
export const IconePasta = base(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>);
export const IconeCartao = base(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></>);
export const IconeCodigoBarras = base(<path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14" />);
export const IconeCopiar = base(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
export const IconeEmail = base(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const IconeMenu = base(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IconeWhatsapp = base(<><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2z" /></>);

const porCategoria: Record<string, ReturnType<typeof base>> = {
  Informática: IconeComputador,
  Negócios: IconeGrafico,
  Design: IconePincel,
  Tecnologia: IconeCodigo,
};
export function IconeCategoria({ categoria, className }: { categoria: string; className?: string }) {
  const I = porCategoria[categoria] ?? IconePasta;
  return <I className={className} />;
}
