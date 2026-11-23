"use client";

import { startTransition, useActionState, useState } from "react";
import { pagar, type EstadoCheckout } from "@/app/checkout/acoes";
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

function Campo({
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
  cursoId, precoCentavos, parcelas,
}: {
  cursoId: string;
  precoCentavos: number;
  parcelas: number[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoCheckout, FormData>(pagar, {});
  const [forma, setForma] = useState<Forma>("PIX");
  const e = estado.campos ?? {};
  const maxParcelas = parcelas[parcelas.length - 1] ?? 1;
  const formas = formasBase.map((f) =>
    f.id === "CREDIT_CARD" && maxParcelas > 1 ? { ...f, detalhe: `Em até ${maxParcelas}x` } : f,
  );
  const textoBotao =
    forma === "PIX" ? "Gerar Pix" : forma === "BOLETO" ? "Gerar boleto" : `Pagar ${formatarPreco(precoCentavos)}`;

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
      <input type="hidden" name="forma" value={forma} />

      <fieldset className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="sr-only">Seus dados</legend>
        <h2 className="flex items-center gap-3 text-lg font-bold text-marca-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marca-900 text-xs text-laranja-500">1</span>
          Seus dados
        </h2>
        <p className="mt-1 text-sm text-slate-500">O acesso ao curso será enviado para este e-mail.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Campo nome="nome" rotulo="Nome completo" autoComplete="name" erro={e.nome} className="sm:col-span-2" required />
          <Campo nome="email" rotulo="E-mail" type="email" autoComplete="email" erro={e.email} className="sm:col-span-2" required />
          <Campo nome="cpf" rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" mascara={mascaraCpf} erro={e.cpf} required />
          <Campo nome="telefone" rotulo="Celular (WhatsApp)" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" mascara={mascaraTelefone} erro={e.telefone} required />
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
                {parcelas.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? `À vista: ${formatarPreco(precoCentavos)}` : `${n}x de ${formatarPreco(Math.round(precoCentavos / n))}`}
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
    </form>
  );
}
