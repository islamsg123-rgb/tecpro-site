import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { Titulo } from "@/components/admin/Blocos";
import { cadastrarAlunoAcao } from "../../acoes";

export const metadata: Metadata = { title: "Cadastrar aluno" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ erro?: string }> };

const erros: Record<string, string> = {
  nome: "Digite o nome completo.",
  email: "Digite um e-mail válido.",
  cpf: "CPF inválido.",
  telefone: "Telefone inválido (DDD + número).",
  curso: "Escolha um curso.",
  matricula: "A Escola Avançada não aceitou a matrícula. Veja o motivo em Alunos > Últimas tentativas de matrícula.",
};

export default async function NovoAluno({ searchParams }: Props) {
  await exigirAdmin("alunos");
  const [{ erro }, cursos] = await Promise.all([searchParams, getCursos()]);
  const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal";
  return (
    <div className="max-w-2xl">
      <Titulo descricao="Para quem pagou por fora (dinheiro, transferência) ou ganhou uma bolsa. O aluno é criado na Escola Avançada, o curso é liberado na hora e ele recebe o e-mail de boas-vindas. Entra no site com este e-mail.">
        Cadastrar aluno
      </Titulo>
      <form action={cadastrarAlunoAcao} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-sm sm:p-8">
        <label className="block font-semibold text-marca-900">Nome completo<input name="nome" required className={campo} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-semibold text-marca-900">E-mail<input name="email" type="email" required className={campo} /></label>
          <label className="block font-semibold text-marca-900">WhatsApp<input name="telefone" required placeholder="(11) 99999-9999" className={campo} /></label>
        </div>
        <label className="block font-semibold text-marca-900">CPF<input name="cpf" required placeholder="000.000.000-00" className={campo} /></label>
        <label className="block font-semibold text-marca-900">Curso
          <select name="cursoId" required defaultValue="" className={`${campo} bg-white`}>
            <option value="" disabled>Escolha…</option>
            {[...cursos].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        {erro && <p className="text-red-700">{erros[erro] ?? "Não foi possível cadastrar."}</p>}
        <button className="rounded-full bg-laranja-500 px-7 py-3 font-bold text-marca-900 hover:bg-laranja-400">Cadastrar e liberar o curso</button>
      </form>
    </div>
  );
}
