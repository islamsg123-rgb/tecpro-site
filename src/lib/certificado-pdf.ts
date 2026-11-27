import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import type { Certificado } from "./dados";
import { CNPJ_TECPRO, SITE_OFICIAL } from "./site";

/** Gera o PDF do certificado (A4 deitado) no padrão visual da Tecpro. */

const AZUL = rgb(1 / 255, 23 / 255, 73 / 255); // #011749
const LARANJA = rgb(1, 165 / 255, 0); // #FFA500
const CINZA = rgb(0.36, 0.4, 0.47);
const CINZA_CLARO = rgb(0.86, 0.88, 0.92);

const raiz = process.cwd();
const ler = (...p: string[]) => readFile(path.join(raiz, ...p));

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function dataPorExtenso(iso: string) {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "numeric", year: "numeric" })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {});
  return `${partes.day} de ${MESES[Number(partes.month) - 1]} de ${partes.year}`;
}

function formatarCpf(cpf?: string | null): string | null {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : null;
}

function centralizado(page: PDFPage, texto: string, y: number, font: PDFFont, size: number, color = AZUL) {
  const w = font.widthOfTextAtSize(texto, size);
  page.drawText(texto, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

/** Quebra o texto em linhas que caibam na largura. */
function quebrar(texto: string, font: PDFFont, size: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(teste, size) > largura && atual) {
      linhas.push(atual);
      atual = palavra;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarPdfCertificado(
  c: Certificado & { cpf?: string | null },
  urlValidacao: string,
  opcoes: { previa?: boolean } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Certificado - ${c.cursoNome}`);
  pdf.setAuthor("Tecpro Multi Ensino");

  const [regular, semi, negrito, logoPng, assinaturaPng] = await Promise.all([
    ler("src/assets/fontes/Poppins-400.ttf").then((b) => pdf.embedFont(b, { subset: true })),
    ler("src/assets/fontes/Poppins-600.ttf").then((b) => pdf.embedFont(b, { subset: true })),
    ler("src/assets/fontes/Poppins-700.ttf").then((b) => pdf.embedFont(b, { subset: true })),
    ler("public/logo-tecpro-transparente.png").then((b) => pdf.embedPng(b)),
    ler("src/assets/assinatura-coordenacao.png").then((b) => pdf.embedPng(b)),
  ]);
  const qr = await pdf.embedPng(await QRCode.toBuffer(urlValidacao, { margin: 1, width: 300, color: { dark: "#011749" } }));

  const page = pdf.addPage([842, 595]);
  const W = page.getWidth();
  const H = page.getHeight();

  // Moldura
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: AZUL, borderWidth: 2 });
  page.drawRectangle({ x: 26, y: 26, width: W - 52, height: H - 52, borderColor: LARANJA, borderWidth: 0.8 });

  // Faixa azul com a logo
  page.drawRectangle({ x: 26, y: H - 132, width: W - 52, height: 106, color: AZUL });
  const logoAltura = 62;
  const logoLargura = (logoPng.width / logoPng.height) * logoAltura;
  page.drawImage(logoPng, { x: (W - logoLargura) / 2, y: H - 115, width: logoLargura, height: logoAltura });
  page.drawRectangle({ x: 26, y: H - 136, width: W - 52, height: 4, color: LARANJA });

  centralizado(page, "CERTIFICADO DE CONCLUSÃO", H - 182, semi, 15, LARANJA);
  centralizado(page, "Certificamos que", H - 214, regular, 12, CINZA);

  // Nome (diminui a fonte se for muito longo)
  let tam = 34;
  while (negrito.widthOfTextAtSize(c.nomeAluno, tam) > W - 160 && tam > 18) tam -= 1;
  centralizado(page, c.nomeAluno, H - 258, negrito, tam);
  const larguraLinha = Math.min(negrito.widthOfTextAtSize(c.nomeAluno, tam) + 40, W - 140);
  page.drawLine({ start: { x: (W - larguraLinha) / 2, y: H - 270 }, end: { x: (W + larguraLinha) / 2, y: H - 270 }, thickness: 0.8, color: CINZA_CLARO });

  // Frase com CPF (quando o aluno tem CPF no cadastro) e o nome do curso em destaque na linha de baixo
  const cpf = formatarCpf(c.cpf);
  const frase = cpf
    ? `portador(a) do CPF ${cpf}, concluiu com êxito o curso online`
    : "concluiu com êxito o curso online";
  centralizado(page, frase, H - 300, regular, 13, CINZA);
  const linhasCurso = quebrar(c.cursoNome, semi, 16, W - 180).slice(0, 2);
  linhasCurso.forEach((linha, i) => centralizado(page, linha, H - 326 - i * 20, semi, 16));

  // Carga horária, conclusão e código de verificação
  const yRotulo = 228;
  const yValor = 211;
  const colunas: [number, string, string][] = [
    [110, "Carga horária", `${c.cargaHoraria} horas`],
    [290, "Conclusão", dataPorExtenso(c.emitidoEm)],
    [490, "Código de verificação", c.codigo],
  ];
  for (const [x, rotulo, valor] of colunas) {
    page.drawText(rotulo, { x, y: yRotulo, size: 8, font: regular, color: CINZA });
    page.drawText(valor, { x, y: yValor, size: 13, font: negrito, color: AZUL });
    page.drawLine({ start: { x, y: yValor - 8 }, end: { x: x + Math.max(150, negrito.widthOfTextAtSize(valor, 13)), y: yValor - 8 }, thickness: 0.6, color: CINZA_CLARO });
  }

  // Validação: QR code + endereço (o código já está acima e o QR leva ao link completo)
  page.drawImage(qr, { x: W - 176, y: 112, width: 92, height: 92 });
  page.drawText("Confira a autenticidade em:", { x: 490, y: 172, size: 8, font: regular, color: CINZA });
  const urlCurta = urlValidacao.replace(/^https?:\/\//, "").replace(/\/[^/]*$/, "");
  page.drawText(urlCurta, { x: 490, y: 160, size: 8, font: regular, color: AZUL });

  // Assinatura institucional: rubrica (PNG transparente) encostada na linha
  const ax = 110;
  const assLargura = 95;
  const assAltura = (assinaturaPng.height / assinaturaPng.width) * assLargura;
  page.drawImage(assinaturaPng, { x: ax + (230 - assLargura) / 2, y: 101, width: assLargura, height: assAltura });
  page.drawLine({ start: { x: ax, y: 108 }, end: { x: ax + 230, y: 108 }, thickness: 0.8, color: AZUL });
  page.drawText("Tecpro Multi Ensino", { x: ax, y: 92, size: 11, font: semi, color: AZUL });
  page.drawText("Coordenação pedagógica", { x: ax, y: 78, size: 9, font: regular, color: CINZA });

  // Rodapé com os dados da escola
  const site = SITE_OFICIAL.replace(/^https?:\/\//, "");
  centralizado(
    page,
    "Os cursos têm como base legal o Decreto Presidencial nº 5.154 de 23 de julho de 2004, Art. 1º e 3º, e a Resolução CNE nº 04/99, Art. 11, Inciso II - Conselho Nacional de Educação.",
    50, semi, 7.5, rgb(0.08, 0.08, 0.1),
  );
  centralizado(page, `Tecpro Multi Ensino  ·  CNPJ ${CNPJ_TECPRO}  ·  ${site}`, 36, regular, 8, CINZA);

  // Prévia do painel: aviso pequeno no canto, para a cópia de exemplo nunca passar por certificado de verdade
  if (opcoes.previa) {
    const aviso = "PRÉVIA · NOME DE EXEMPLO · SEM VALIDADE";
    page.drawText(aviso, { x: W - 40 - semi.widthOfTextAtSize(aviso, 7), y: H - 150, size: 7, font: semi, color: CINZA });
  }

  return pdf.save();
}
