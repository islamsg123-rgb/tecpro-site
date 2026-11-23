import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

/** Termos de uso. Texto-base: revisar com um advogado antes de vender em escala. */
export default function Termos() {
  const secoes: { t: string; p: string[] }[] = [
    {
      t: "1. Sobre a Tecpro",
      p: ["A Tecpro Multi Ensino oferece cursos livres online. Ao se matricular, você concorda com estes termos."],
    },
    {
      t: "2. Matrícula e acesso",
      p: [
        "O acesso é pessoal e intransferível. Você recebe o acesso no e-mail informado na matrícula.",
        "Nos cursos pagos, o acesso é liberado após a confirmação do pagamento. Nos cursos gratuitos, o acesso às aulas é liberado na hora, sem custo.",
      ],
    },
    {
      t: "3. Conclusão do curso",
      p: ["Para concluir, é preciso assistir às aulas e ser aprovado nas atividades de cada aula, na ordem do curso."],
    },
    {
      t: "4. Certificado",
      p: [
        "O certificado de conclusão é emitido pela Tecpro na área do aluno, depois que todas as aulas forem concluídas. A emissão do certificado é opcional e pode ter uma taxa, informada ao aluno quando ele conclui o curso. Pagamento por Pix, boleto ou cartão.",
        "Todo certificado tem um código que pode ser conferido na página Validar certificado.",
      ],
    },
    {
      t: "5. Arrependimento",
      p: ["Compras feitas pela internet podem ser canceladas em até 7 dias, conforme o Código de Defesa do Consumidor."],
    },
    {
      t: "6. Dados pessoais",
      p: ["Usamos seus dados apenas para a matrícula, o acesso às aulas, a emissão do certificado e o contato sobre seus cursos."],
    },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-marca-900 sm:text-4xl">Termos de uso</h1>
      <div className="mt-8 space-y-8">
        {secoes.map((s) => (
          <section key={s.t}>
            <h2 className="text-lg font-bold text-marca-900">{s.t}</h2>
            {s.p.map((p) => <p key={p} className="mt-2 leading-relaxed text-slate-600">{p}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
