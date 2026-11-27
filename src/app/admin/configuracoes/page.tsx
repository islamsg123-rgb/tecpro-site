import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { obterConfigLoja } from "@/lib/dados";
import { situacaoChaves } from "@/lib/pagamentos";
import { Titulo } from "@/components/admin/Blocos";
import { salvarConfiguracoes } from "../acoes";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Configurações da loja" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ salvo?: string; erro?: string }> };

const campo = "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-marca-900";

function Chave({ nome, ligado, titulo, texto }: { nome: string; ligado: boolean; titulo: string; texto: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
      <input type="checkbox" name={nome} defaultChecked={ligado} className="mt-1 h-4 w-4 accent-marca-900" />
      <span>
        <span className="block font-semibold text-marca-900">{titulo}</span>
        <span className="block text-sm text-slate-500">{texto}</span>
      </span>
    </label>
  );
}

export default async function Configuracoes({ searchParams }: Props) {
  await exigirAdmin("loja");
  const [{ salvo, erro }, loja, chavesConfiguradas] = await Promise.all([searchParams, obterConfigLoja(), situacaoChaves()]);
  const vitalicio = loja.mesesDeAcesso === null;

  return (
    <div className="max-w-3xl">
      <Titulo descricao="Regras e informações que valem para o site inteiro.">Configurações da loja</Titulo>

      <form action={salvarConfiguracoes} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">Prazo de acesso do aluno</h2>
          <p className="mt-1 text-sm text-slate-500">
            Por quanto tempo o aluno pode assistir ao curso depois da matrícula. Vale para quem se matricular a partir de agora;
            quem já é aluno mantém o prazo que tinha.
          </p>
          <div className="mt-5 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
              <input type="radio" name="prazo" value="vitalicio" defaultChecked={vitalicio} className="h-4 w-4 accent-marca-900" />
              <span className="font-semibold text-marca-900">Vitalício</span>
              <span className="text-sm text-slate-500">(sem data para acabar)</span>
            </label>
            <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
              <input type="radio" name="prazo" value="meses" defaultChecked={!vitalicio} className="h-4 w-4 accent-marca-900" />
              <span className="font-semibold text-marca-900">Por</span>
              <input type="number" name="meses" min={1} max={120} defaultValue={loja.mesesDeAcesso ?? 12} className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-marca-900" />
              <span className="font-semibold text-marca-900">meses</span>
            </label>
          </div>
          {erro === "meses" && <p className="mt-3 text-sm text-red-700">Informe um número de meses entre 1 e 120.</p>}
        </section>

        <section id="pagamentos" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">Sistema de pagamento</h2>
          <p className="mt-1 text-sm text-slate-500">
            Onde os novos pagamentos (cartão, Pix e boleto) são processados. Pagamentos já feitos continuam aparecendo no Financeiro.
            Se o sistema escolhido estiver sem chave na Vercel, o site usa o outro sozinho.
          </p>
          <div className="mt-5 space-y-3">
            {([
              ["mercadopago", "Mercado Pago", chavesConfiguradas.mercadopago, chavesConfiguradas.mercadopagoEmTeste ? "chave de TESTE" : "chave de produção"],
              ["asaas", "Asaas", chavesConfiguradas.asaas, ""],
            ] as const).map(([valor, rotulo, ligado, modo]) => (
              <label key={valor} className="flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
                <input type="radio" name="gateway" value={valor} defaultChecked={(loja.gateway ?? "mercadopago") === valor} className="h-4 w-4 accent-marca-900" />
                <span className="font-semibold text-marca-900">{rotulo}</span>
                <Dica texto={!ligado ? "A chave deste sistema não está cadastrada na Vercel. Sem ela, ele não consegue receber pagamentos." : modo === "chave de TESTE" ? "Está ligado, mas com chave de teste: os pagamentos são de mentira. Troque pela chave de produção para vender de verdade." : "A chave está cadastrada na Vercel e o sistema pode receber pagamentos."}>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ligado ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
                    {ligado ? `ligado${modo ? ` (${modo})` : ""}` : "sem chave na Vercel"}
                  </span>
                </Dica>
              </label>
            ))}
          </div>
          {chavesConfiguradas.mercadopago && !chavesConfiguradas.mercadopagoChavePublica && (
            <p className="mt-3 text-sm text-red-700">Falta a MERCADOPAGO_PUBLIC_KEY na Vercel: sem ela, o pagamento com cartão não funciona.</p>
          )}
        </section>

        <section id="certificados" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">Certificado</h2>
          <p className="mt-1 text-sm text-slate-500">
            Os preços dos pacotes de certificado, o vídeo de parabéns e a prévia do certificado agora ficam numa página só.
          </p>
          <Link href="/admin/loja/certificado" className="mt-4 inline-block rounded-full border border-marca-900 px-5 py-2 text-sm font-semibold text-marca-900 hover:bg-marca-50">
            Abrir Loja virtual &gt; Certificado
          </Link>
        </section>

        <section id="site" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">O que aparece no site</h2>
          <div className="mt-5 space-y-3">
            <Chave nome="pesquisaNasAulas" ligado={loja.pesquisaNasAulas} titulo="Botão de pesquisa de satisfação nas aulas" texto="O aluno pode, se quiser, dar uma nota e deixar um comentário. As respostas aparecem em Vendas > Pesquisa de satisfação." />
            <Chave nome="mostrarDepoimentos" ligado={loja.mostrarDepoimentos} titulo="Depoimentos na página inicial" texto="Mostra os depoimentos ativos cadastrados em Loja virtual > Depoimentos." />
          </div>
          <label className="mt-5 block">
            <span className="text-sm font-semibold text-marca-900">Código do Google Analytics</span>
            <span className="block text-sm text-slate-500">Começa com G- (no Google Analytics: Administrador &gt; Fluxos de dados &gt; seu site &gt; ID da métrica). Deixe em branco para desligar.</span>
            <input name="googleAnalyticsId" defaultValue={loja.googleAnalyticsId ?? ""} placeholder="G-XXXXXXXXXX" className={`${campo} mt-2 max-w-xs uppercase`} />
          </label>
          {erro === "ga" && <p className="mt-3 text-sm text-red-700">Esse código não parece do Google Analytics. Ele começa com G- e tem letras e números, por exemplo G-AB12CD34EF.</p>}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">Contatos de atendimento</h2>
          <p className="mt-1 text-sm text-slate-500">Aparecem no rodapé do site. Deixe em branco o que não quiser mostrar.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-marca-900">WhatsApp
              <input name="whatsapp" defaultValue={loja.whatsapp} placeholder="(11) 99999-9999" className={`mt-1 ${campo}`} />
            </label>
            <label className="text-sm font-semibold text-marca-900">E-mail
              <input name="emailContato" type="email" defaultValue={loja.emailContato} placeholder="contato@tecpromultiensino.com.br" className={`mt-1 ${campo}`} />
            </label>
            <label className="text-sm font-semibold text-marca-900">Instagram
              <input name="instagram" defaultValue={loja.instagram} placeholder="@tecpromultiensino" className={`mt-1 ${campo}`} />
            </label>
          </div>
          {erro === "contato" && <p className="mt-3 text-sm text-red-700">Confira o WhatsApp (DDD + número) e o e-mail.</p>}
        </section>

        <div className="flex items-center gap-4">
          <button className="rounded-full bg-laranja-500 px-7 py-3 font-bold text-marca-900 hover:bg-laranja-400">Salvar</button>
          {salvo && <p className="text-sm font-semibold text-green-700">Salvo!</p>}
        </div>
      </form>
    </div>
  );
}
