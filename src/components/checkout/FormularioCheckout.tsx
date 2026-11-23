"use client";

import { startTransition, useActionState, useState } from "react";
import { conferirCupom, pagar, salvarContato, type EstadoCheckout } from "@/app/checkout/acoes";
import { formatarPreco } from "@/lib/formatar";
import {
  mascaraCartao, mascaraCep, mascaraCpf, mascaraTelefone,
} from "@/lib/validacao";
import { IconeCadeado, IconeCartao, IconeCodigoBarras, IconePix } from "../Icones";

type Forma = "PIX" | "CREDIT_CARD" | "BOLETO";

const formasBase: { id: Forma; rotulo: string; detalhe: string; Icone: typeof IconePix }[] = [
  { id: "PIX", rotulo: "Pix", detalhe: "Aprovação na hora", Icone: IconePix },
  { id: "CREDIT_CARD", rotulo: "Cartão", detalhe: "Crédito", Icone: IconeCartao },
  { id: "BOLETO", rotulo: "Boleto", detalhe: "Até 3 dias úteis", Icone: IconeCodigoBarras },
];

export function Campo({
  nome, rotulo, erro, className = "", mascara, ...resto
}: {
  nome: string;
  rotulo: string;
  erro?: string;
  mascara?: (v: string) => string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{rotulo}</span>
      <input
        name={nome}
        {...resto}
        onChange={mascara ? (e) => (e.currentTarget.value = mascara(e.currentTarget.value)) : undefined}
        aria-invalid={Boolean(erro)}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-marca-500 focus:ring-4 focus:ring-marca-100 ${
          erro ? "border-red-400" : "border-slate-300"
        }`}
      />
      {erro && <span className="mt-1 block text-xs font-medium text-red-600">{erro}</span>}
    </label>
  );
}

export function FormularioCheckout({
  cursoId, precoCentavos, parcelas, tipo = "curso", nomeInicial, emailInicial,
}: {
  cursoId: string;
  precoCentavos: number;
  parcelas: number[];
  tipo?: "curso" | "certificado";
  nomeInicial?: string;
  emailInicial?: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoCheckout, FormData>(pagar, {});
  const [forma, setForma] = useState<Forma>("PIX");
  // Etapa 1: dados de contato (já ficam guardados). Etapa 2: pagamento.
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [contato, setContato] = useState<EstadoCheckout>({});
  // Cupom
  const [cupomDigitado, setCupomDigitado] = useState("");
  const [cupom, setCupom] = useState<{ codigo: string; rotulo: string; descontoCentavos: number } | null>(null);
  const [erroCupom, setErroCupom] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [valor, setValor] = useState(precoCentavos);
  const [opcoes, setOpcoes] = useState(parcelas);

  const e = { ...(contato.campos ?? {}), ...(estado.campos ?? {}) };
  const maxParcelas = opcoes[opcoes.length - 1] ?? 1;
  const formas = formasBase.map((f) =>
    f.id === "CREDIT_CARD" && maxParcelas > 1 ? { ...f, detalhe: `Em até ${maxParcelas}x` } : f,
  );
  const textoBotao =
    forma === "PIX" ? "Gerar Pix" : forma === "BOLETO" ? "Gerar boleto" : `Pagar ${formatarPreco(valor)}`;

  async function continuar(form: HTMLFormElement) {
    setSalvandoContato(true);
    const r = await salvarContato(new FormData(form));
    setSalvandoContato(false);
    setContato(r);
    if (r.ok) setEtapa(2);
  }

  async function aplicarCupom() {
    if (!cupomDigitado.trim()) return;
    setConferindo(true);
    setErroCupom("");
    const r = await conferirCupom(cursoId, tipo, cupomDigitado);
    setConferindo(false);
    if (!r.ok) {
      setErroCupom(r.erro);
      return;
    }
    setCupom({ codigo: r.codigo, rotulo: r.rotulo, descontoCentavos: r.descontoCentavos });
    setValor(r.valorCentavos);
    setOpcoes(r.parcelas);
  }

  function tirarCupom() {
    setCupom(null);
    setCupomDigitado("");
    setValor(precoCentavos);
    setOpcoes(parcelas);
  }

  return (
    <form
      className="space-y-8"
      noValidate
      onSubmit={(ev) => {
        // Envio manual para o formulário NÃO ser apagado se der algum erro.
        ev.preventDefault();
        const dados = new FormData(ev.currentTarget);
        startTransition(() => acao(dados));
      }}
    >
      <input type="hidden" name="cursoId" value={cursoId} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="forma" value={forma} />
      <input type="hidden" name="cupom" value={cupom?.codigo ?? ""} />

      <fieldset className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="sr-only">Seus dados</legend>
        <h2 className="flex items-center gap-3 text-lg font-bold text-marca-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marca-900 text-xs text-laranja-500">1</span>
          Seus dados
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {tipo === "curso" ? "O acesso ao curso será enviado para este e-mail." : "Dados para a cobrança do certificado."}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Campo nome="nome" rotulo="Nome completo" autoComplete="name" defaultValue={nomeInicial} erro={e.nome} className="sm:col-span-2" required />
          <Campo nome="email" rotulo="E-mail" type="email" autoComplete="email" defaultValue={emailInicial} erro={e.email} className="sm:col-span-2" required />
          <Campo nome="cpf" rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" mascara={mascaraCpf} erro={e.cpf} required />
          <Campo nome="telefone" rotulo="Celular (WhatsApp)" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" mascara={mascaraTelefone} erro={e.telefone} required />
        </div>
        {etapa === 1 && (
          <>
            {contato.erro && <p role="alert" className="mt-5 text-sm font-medium text-red-600">{contato.erro}</p>}
            <button
              type="button"
              disabled={salvandoContato}
              onClick={(ev) => continuar(ev.currentTarget.form!)}
              className="mt-6 w-full rounded-full bg-laranja-500 py-4 text-lg font-bold text-marca-900 shadow-lg shadow-laranja-500/30 transition hover:bg-laranja-400 disabled:cursor-wait disabled:opacity-70"
            >
              {salvandoContato ? "Salvando…" : "Continuar para o pagamento"}
            </button>
          </>
        )}
      </fieldset>

      {etapa === 2 && (
      <>

      <fieldset className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="sr-only">Cupom de desconto</legend>
        {cupom ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
            <span>Cupom <strong>{cupom.codigo}</strong> aplicado: {cupom.rotulo} (−{formatarPreco(cupom.descontoCentavos)})</span>
            <button type="button" onClick={tirarCupom} className="font-semibold underline">remover</button>
          </div>
        ) : (
          <div>
            <label htmlFor="campo-cupom" className="mb-1.5 block text-sm font-medium text-slate-700">Tem um cupom de desconto?</label>
            <div className="flex gap-2">
              <input
                id="campo-cupom"
                value={cupomDigitado}
                onChange={(ev) => setCupomDigitado(ev.currentTarget.value.toUpperCase())}
                onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); aplicarCupom(); } }}
                placeholder="CÓDIGO"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] uppercase outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
              />
              <button type="button" onClick={aplicarCupom} disabled={conferindo} className="shrink-0 rounded-xl bg-marca-900 px-5 font-semibold text-white hover:bg-marca-800 disabled:opacity-70">
                {conferindo ? "…" : "Aplicar"}
              </button>
            </div>
            {erroCupom && <p className="mt-1 text-xs font-medium text-red-600">{erroCupom}</p>}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="font-semibold text-slate-600">Total</span>
          <span className="text-right">
            {cupom && <span className="mr-2 text-sm text-slate-400 line-through">{formatarPreco(precoCentavos)}</span>}
            <span className="font-display text-2xl font-extrabold text-marca-900">{formatarPreco(valor)}</span>
          </span>
        </div>
      </fieldset>

      <fieldset className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="sr-only">Forma de pagamento</legend>
        <h2 className="flex items-center gap-3 text-lg font-bold text-marca-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marca-900 text-xs text-laranja-500">2</span>
          Pagamento
        </h2>
        <div className="mt-6 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Forma de pagamento">
          {formas.map(({ id, rotulo, detalhe, Icone }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={forma === id}
              onClick={() => setForma(id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-4 text-center transition ${
                forma === id ? "border-laranja-500 bg-laranja-500/5" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Icone className={`h-7 w-7 ${forma === id ? "text-laranja-600" : "text-slate-400"}`} />
              <span className="text-sm font-bold text-marca-900">{rotulo}</span>
              <span className="hidden text-xs text-slate-500 sm:block">{detalhe}</span>
            </button>
          ))}
        </div>

        {forma === "PIX" && (
          <p className="mt-6 rounded-2xl bg-marca-50 p-4 text-sm text-slate-600">
            Ao continuar, mostramos o QR Code e o código “copia e cola”. Assim que o Pix cair, o acesso é liberado automaticamente.
          </p>
        )}
        {forma === "BOLETO" && (
          <p className="mt-6 rounded-2xl bg-marca-50 p-4 text-sm text-slate-600">
            O boleto vence em 3 dias. A compensação leva até 3 dias úteis após o pagamento, e então liberamos o acesso.
          </p>
        )}
        {forma === "CREDIT_CARD" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-6">
            <Campo nome="numeroCartao" rotulo="Número do cartão" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" mascara={mascaraCartao} erro={e.numeroCartao} className="sm:col-span-6" />
            <Campo nome="nomeNoCartao" rotulo="Nome impresso no cartão" autoComplete="cc-name" erro={e.nomeNoCartao} className="sm:col-span-6" />
            <Campo nome="mesValidade" rotulo="Mês" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength={2} erro={e.validade} className="sm:col-span-2" />
            <Campo nome="anoValidade" rotulo="Ano" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AA" maxLength={4} className="sm:col-span-2" />
            <Campo nome="cvv" rotulo="CVV" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} erro={e.cvv} className="sm:col-span-2" />
            <Campo nome="cep" rotulo="CEP do titular" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" mascara={mascaraCep} erro={e.cep} className="sm:col-span-3" />
            <Campo nome="numeroEndereco" rotulo="Nº do endereço" erro={e.numeroEndereco} className="sm:col-span-3" />
            <label className="block sm:col-span-6">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Parcelas</span>
              <select name="parcelas" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px]">
                {opcoes.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? `À vista: ${formatarPreco(valor)}` : `${n}x de ${formatarPreco(Math.round(valor / n))} sem juros`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      {estado.erro && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-full bg-laranja-500 py-4 text-lg font-bold text-marca-900 shadow-lg shadow-laranja-500/30 transition hover:bg-laranja-400 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? "Processando…" : textoBotao}
      </button>
      <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <IconeCadeado className="h-4 w-4" /> Pagamento processado com segurança pelo Asaas
      </p>
      </>
      )}
    </form>
  );
}
