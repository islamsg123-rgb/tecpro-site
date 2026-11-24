/*
 * Telas de "carregando" (esqueletos): blocos cinza pulsando no formato da
 * página que vai abrir, com o aviso "Carregando..." para o aluno.
 */

export function Bloco({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

function BlocoEscuro({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />;
}

export function AvisoCarregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm font-semibold text-marca-900">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-laranja-500 border-t-transparent" />
      {texto}
    </p>
  );
}

/** Página genérica (usada quando a rota não tem um esqueleto próprio). */
export function EsqueletoGenerico() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <AvisoCarregando />
      <Bloco className="mt-6 h-10 w-2/3 max-w-lg" />
      <Bloco className="mt-4 h-4 w-full max-w-2xl" />
      <Bloco className="mt-2 h-4 w-5/6 max-w-xl" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Bloco key={i} className="h-48 rounded-3xl" />)}
      </div>
    </div>
  );
}

/** Catálogo de cursos. */
export function EsqueletoCatalogo() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <AvisoCarregando texto="Carregando cursos..." />
      <Bloco className="mt-6 h-10 w-72" />
      <div className="mt-6 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => <Bloco key={i} className="h-9 w-28 rounded-full" />)}
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <Bloco className="aspect-[16/10] rounded-none" />
            <div className="p-5">
              <Bloco className="h-5 w-3/4" />
              <Bloco className="mt-3 h-4 w-1/2" />
              <Bloco className="mt-5 h-9 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Página de venda de um curso (faixa azul no topo + conteúdo). */
export function EsqueletoPaginaCurso() {
  return (
    <>
      <section className="relative overflow-hidden bg-marca-900 text-white">
        <div className="fundo-grade absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:pb-24">
          <p role="status" className="flex items-center gap-2 text-sm font-semibold text-laranja-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-laranja-500 border-t-transparent" />
            Carregando curso...
          </p>
          <div className="lg:max-w-[calc(100%-420px)]">
            <BlocoEscuro className="mt-6 h-12 w-full max-w-xl" />
            <BlocoEscuro className="mt-5 h-5 w-full max-w-2xl" />
            <BlocoEscuro className="mt-2 h-5 w-4/5 max-w-xl" />
            <div className="mt-8 flex flex-wrap gap-3">
              {[0, 1, 2, 3].map((i) => <BlocoEscuro key={i} className="h-9 w-44 rounded-full" />)}
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
            <Bloco className="h-7 w-48" />
            <Bloco className="mt-5 h-4 w-full" />
            <Bloco className="mt-2 h-4 w-full" />
            <Bloco className="mt-2 h-4 w-2/3" />
          </div>
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => <Bloco key={i} className="h-16 rounded-2xl" />)}
          </div>
        </div>
        <Bloco className="hidden h-96 rounded-3xl lg:block lg:-mt-48" />
      </div>
    </>
  );
}

/** Meus cursos (área do aluno). */
export function EsqueletoMeusCursos() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <AvisoCarregando texto="Carregando seus cursos..." />
      <Bloco className="mt-5 h-10 w-56" />
      <div className="mt-8 h-36 animate-pulse rounded-3xl bg-marca-900/90" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <Bloco className="aspect-[16/10] rounded-none" />
            <div className="p-5">
              <Bloco className="h-5 w-3/4" />
              <Bloco className="mt-4 h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Página do curso na área do aluno (lista de aulas). */
export function EsqueletoCursoAluno() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <AvisoCarregando texto="Carregando curso..." />
      <Bloco className="mt-5 h-10 w-2/3 max-w-xl" />
      <Bloco className="mt-4 h-3 w-full max-w-md rounded-full" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <Bloco key={i} className="h-14 rounded-2xl" />)}
      </div>
    </div>
  );
}

/** Aula (vídeo + lista lateral). */
export function EsqueletoAula() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <AvisoCarregando texto="Carregando aula..." />
        <Bloco className="mt-5 h-4 w-40" />
        <Bloco className="mt-2 h-8 w-3/4" />
        <div className="mt-6 flex aspect-video animate-pulse items-center justify-center rounded-3xl bg-marca-900/90">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-laranja-500 border-t-transparent" />
        </div>
        <div className="mt-8 flex gap-2">
          <Bloco className="h-11 w-32 rounded-full" />
          <Bloco className="h-11 w-32 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <Bloco key={i} className="h-12 rounded-2xl" />)}
      </div>
    </div>
  );
}

/** Painel administrativo (dentro do menu lateral). */
export function EsqueletoPainel() {
  return (
    <div>
      <AvisoCarregando />
      <Bloco className="mt-5 h-9 w-64" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Bloco key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Bloco className="mt-6 h-80 rounded-2xl" />
    </div>
  );
}

/** Checkout. */
export function EsqueletoCheckout() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px]">
      <div>
        <AvisoCarregando texto="Preparando pagamento..." />
        <Bloco className="mt-5 h-9 w-64" />
        <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-7">
          {[0, 1, 2, 3].map((i) => <Bloco key={i} className="h-12" />)}
        </div>
      </div>
      <Bloco className="h-72 rounded-3xl" />
    </div>
  );
}
