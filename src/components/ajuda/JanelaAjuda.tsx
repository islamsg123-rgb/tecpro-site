"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { enviarMensagemAjuda, quemEstaLogado } from "@/app/ajuda/acoes";
import { EVENTO_ABRIR_AJUDA } from "./BotaoAbrirAjuda";

/**
 * Bolinha de ajuda no canto inferior direito (site e área do aluno; não aparece no painel).
 * Ao tocar, abre uma janelinha para a pessoa contar o problema. A mensagem vai para o painel,
 * em Mensagens, separada por onde foi enviada (Área do aluno ou Loja virtual).
 */

const TIPOS: { id: string; rotulo: string; dica: string }[] = [
  { id: "video", rotulo: "Vídeo não abre", dica: "Qual vídeo? O que aparece na tela (tela preta, carregando, erro)?" },
  { id: "erro", rotulo: "Erro no site", dica: "O que você estava tentando fazer e o que aconteceu?" },
  { id: "acesso", rotulo: "Não consigo entrar", dica: "Com qual e-mail você tenta entrar? O link ou o código chegou?" },
  { id: "pagamento", rotulo: "Pagamento", dica: "Como você pagou (Pix, cartão, boleto) e o que aconteceu?" },
  { id: "certificado", rotulo: "Certificado", dica: "De qual curso é o certificado e qual é a dúvida?" },
  { id: "duvida", rotulo: "Dúvida sobre curso", dica: "Qual curso te interessa e o que você quer saber?" },
  { id: "outro", rotulo: "Outro assunto", dica: "Conte para a gente como podemos ajudar." },
];

/** Reduz a imagem no próprio aparelho (até 1280 px, JPEG) para o envio ficar leve. */
async function reduzirImagem(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    await new Promise((ok, falha) => { img.onload = ok; img.onerror = falha; img.src = url; });
    const escala = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const Icone = ({ aberto }: { aberto: boolean }) =>
  aberto ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M10 8.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4" />
      <circle cx="12" cy="13.4" r=".6" fill="currentColor" />
    </svg>
  );

export function JanelaAjuda() {
  const pathname = usePathname() ?? "/";
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("");
  const [quem, setQuem] = useState<{ email: string; nome: string | null } | null | undefined>(undefined);
  const [print, setPrint] = useState("");
  const [erroPrint, setErroPrint] = useState("");
  const [abertoEm, setAbertoEm] = useState(0);
  const [estado, enviar, enviando] = useActionState(enviarMensagemAjuda, {});
  const [enviada, setEnviada] = useState(false);
  // Campos controlados: se der erro no envio, o texto digitado não se perde.
  const [campos, setCampos] = useState({ mensagem: "", nome: "", email: "", telefone: "" });
  const campo = (k: keyof typeof campos) => ({
    name: k,
    value: campos[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCampos((c) => ({ ...c, [k]: e.target.value })),
  });

  useEffect(() => { if (estado.ok) setEnviada(true); }, [estado]);

  // Ao abrir: descobre se a pessoa está logada (para já preencher nome e e-mail).
  useEffect(() => {
    if (!aberto) return;
    setAbertoEm(Date.now());
    if (quem === undefined) quemEstaLogado().then(setQuem).catch(() => setQuem(null));
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto, quem]);

  // Balãozinho "Precisa de ajuda?" que sai da bolinha de tempos em tempos (some quando a pessoa usa ou fecha).
  const [balao, setBalao] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem("tecpro_balao_ajuda")) setDispensado(true); } catch { /* sem armazenamento */ }
  }, []);
  useEffect(() => {
    if (dispensado || aberto) { setBalao(false); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let vezes = 0;
    const ciclo = (espera: number) => {
      timers.push(setTimeout(() => {
        setBalao(true);
        timers.push(setTimeout(() => {
          setBalao(false);
          if (++vezes < 4) ciclo(25000); // aparece no máximo 4 vezes por página
        }, 6000));
      }, espera));
    };
    ciclo(3000);
    return () => timers.forEach(clearTimeout);
  }, [dispensado, aberto, pathname]);
  function dispensar() {
    setDispensado(true);
    try { sessionStorage.setItem("tecpro_balao_ajuda", "1"); } catch { /* sem armazenamento */ }
  }

  // Outros botões do site (ex.: "Nome errado?" no certificado) abrem a janela já com assunto e texto.
  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent<{ tipo?: string; mensagem?: string }>).detail ?? {};
      setEnviada(false);
      if (d.tipo) setTipo(d.tipo);
      if (d.mensagem) setCampos((c) => ({ ...c, mensagem: d.mensagem! }));
      dispensar();
      setAberto(true);
    };
    window.addEventListener(EVENTO_ABRIR_AJUDA, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AJUDA, abrir);
  }, []);

  // Fecha ao trocar de página.
  useEffect(() => setAberto(false), [pathname]);

  if (pathname.startsWith("/admin")) return null;

  // Na página do curso, no celular, existe uma barra fixa de compra embaixo: a bolinha sobe um pouco.
  const temBarraEmbaixo = /^\/cursos\/[^/]+$/.test(pathname);
  const naAreaDoAluno = pathname.startsWith("/minha-conta");
  const dica = TIPOS.find((t) => t.id === tipo)?.dica ?? "Escolha o assunto acima e conte o que aconteceu.";

  function novaMensagem() {
    setEnviada(false);
    setTipo("");
    setPrint("");
    setCampos((c) => ({ ...c, mensagem: "" }));
  }

  return (
    <div className={`fixed right-4 z-40 print:hidden sm:right-6 ${temBarraEmbaixo ? "bottom-24 lg:bottom-6" : "bottom-4 sm:bottom-6"}`}>
      {aberto && (
        <>
          {/* Fundo escuro no celular: tocar fora fecha */}
          <div className="fixed inset-0 bg-marca-950/40 sm:hidden" onClick={() => setAberto(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ajuda-titulo"
            className="fixed inset-x-3 bottom-3 top-auto flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:bottom-[72px] sm:right-0 sm:max-h-[min(640px,calc(100dvh-120px))] sm:w-[380px]"
          >
            <div className="flex items-start justify-between gap-3 bg-marca-900 px-5 py-4 text-white">
              <div>
                <p id="ajuda-titulo" className="font-display text-lg font-bold">Precisa de ajuda?</p>
                <p className="mt-0.5 text-sm text-white/70">Conte o que aconteceu. A equipe Tecpro responde no seu e-mail.</p>
              </div>
              <button onClick={() => setAberto(false)} className="-mr-1 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar">
                <Icone aberto />
              </button>
            </div>

            {enviada ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-3xl text-green-700" aria-hidden>✓</span>
                <p className="mt-4 text-lg font-bold text-marca-900">Mensagem enviada!</p>
                <p className="mt-1 text-sm text-slate-600">Recebemos seu pedido e vamos responder no seu e-mail o quanto antes.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button onClick={novaMensagem} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-marca-900 hover:text-marca-900">Enviar outra</button>
                  <button onClick={() => setAberto(false)} className="rounded-full bg-marca-900 px-5 py-2 text-sm font-semibold text-white hover:bg-marca-800">Fechar</button>
                </div>
              </div>
            ) : (
              <form action={enviar} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <input type="hidden" name="tipo" value={tipo} />
                  <input type="hidden" name="pagina" value={pathname} />
                  <input type="hidden" name="aberto" value={abertoEm} />
                  <input type="hidden" name="print" value={print} />
                  {/* Armadilha para robôs: pessoas não veem este campo */}
                  <input type="text" name="site" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />

                  <fieldset>
                    <legend className="text-sm font-semibold text-marca-900">Qual é o assunto?</legend>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {TIPOS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={tipo === t.id}
                          onClick={() => setTipo(t.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${tipo === t.id ? "border-marca-900 bg-marca-900 text-white" : "border-slate-200 text-slate-600 hover:border-marca-900 hover:text-marca-900"}`}
                        >
                          {t.rotulo}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block text-sm font-semibold text-marca-900">
                    Descreva o problema
                    <textarea {...campo("mensagem")} required minLength={5} maxLength={3000} rows={4} placeholder={dica} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-normal focus:border-marca-900 focus:outline-none" />
                  </label>

                  {quem ? (
                    <p className="rounded-xl bg-marca-50 px-3 py-2 text-sm text-marca-900">
                      Vamos responder em <strong className="break-all">{quem.email}</strong>
                      <input type="hidden" name="nome" value={quem.nome ?? ""} />
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-marca-900">
                        Seu nome
                        <input {...campo("nome")} autoComplete="name" maxLength={120} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-normal focus:border-marca-900 focus:outline-none" />
                      </label>
                      <label className="block text-sm font-semibold text-marca-900">
                        Seu e-mail
                        <input {...campo("email")} type="email" required autoComplete="email" maxLength={200} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-normal focus:border-marca-900 focus:outline-none" />
                      </label>
                    </div>
                  )}
                  <label className="block text-sm font-semibold text-marca-900">
                    WhatsApp <span className="font-normal text-slate-400">(opcional)</span>
                    <input {...campo("telefone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="(11) 90000-0000" className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-normal focus:border-marca-900 focus:outline-none" />
                  </label>

                  <div className="text-sm">
                    {print ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={print} alt="Imagem anexada" className="h-14 w-20 rounded-lg border border-slate-200 object-cover" />
                        <button type="button" onClick={() => setPrint("")} className="text-slate-500 underline hover:text-red-600">tirar imagem</button>
                      </div>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-marca-700 hover:text-marca-900">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.5 12.6 21a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
                        Anexar print da tela <span className="font-normal text-slate-400">(opcional)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={async (e) => {
                            const arq = e.currentTarget.files?.[0];
                            setErroPrint("");
                            if (!arq) return;
                            if (!arq.type.startsWith("image/")) return setErroPrint("Escolha uma imagem (foto ou print).");
                            try { setPrint(await reduzirImagem(arq)); } catch { setErroPrint("Não conseguimos abrir essa imagem."); }
                          }}
                        />
                      </label>
                    )}
                    {erroPrint && <p className="mt-1 text-red-700">{erroPrint}</p>}
                  </div>

                  <p className="text-xs text-slate-400">
                    Junto com a mensagem vai a página em que você está{naAreaDoAluno ? " (e o curso e a aula, se for o caso)" : ""}, para a gente achar o problema mais rápido.
                  </p>
                </div>

                <div className="border-t border-slate-100 px-5 py-3">
                  {estado.erro && <p className="mb-2 text-sm text-red-700" role="alert">{estado.erro}</p>}
                  <div className="flex items-center justify-between gap-3">
                    <span />
                    <button disabled={!tipo || enviando} className="rounded-full bg-laranja-500 px-6 py-2.5 font-bold text-marca-900 hover:bg-laranja-400 disabled:opacity-50">
                      {enviando ? "Enviando…" : "Enviar"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </>
      )}

      {/* Balãozinho que sai da bolinha */}
      <div
        aria-hidden={!balao}
        className={`absolute bottom-2 right-[68px] flex origin-right items-center gap-1 whitespace-nowrap rounded-2xl rounded-br-md bg-white py-2 pl-4 pr-2 text-sm font-semibold text-marca-900 shadow-lg ring-1 ring-slate-200 transition-all duration-500 ease-out ${balao && !aberto ? "translate-x-0 scale-100 opacity-100" : "pointer-events-none translate-x-3 scale-75 opacity-0"}`}
      >
        <button type="button" tabIndex={balao ? 0 : -1} onClick={() => { dispensar(); setAberto(true); }} className="hover:underline">
          Precisa de ajuda? <span aria-hidden>👋</span>
        </button>
        <button type="button" tabIndex={balao ? 0 : -1} onClick={dispensar} aria-label="Fechar aviso" className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-marca-900">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      {/* Onda suave em volta da bolinha enquanto o balão aparece */}
      {balao && !aberto && <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-laranja-500/50" aria-hidden />}

      <button
        onClick={() => { dispensar(); setAberto((v) => !v); }}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar ajuda" : "Precisa de ajuda? Fale com a gente"}
        title="Precisa de ajuda?"
        className={`relative grid h-14 w-14 place-items-center rounded-full shadow-lg ring-4 ring-white/70 transition-transform hover:scale-105 ${aberto ? "bg-marca-900 text-white" : "bg-laranja-500 text-marca-900"} ${aberto ? "max-sm:hidden" : ""}`}
      >
        <Icone aberto={aberto} />
      </button>
    </div>
  );
}
