import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import type { Certificado } from "./dados";

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

export async function gerarPdfCertificado(c: Certificado, urlValidacao: string): Promise<Uint8Array> {
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

  const frase = `concluiu com êxito o curso livre online “${c.cursoNome}”, com carga horária de ${c.cargaHoraria} horas.`;
  quebrar(frase, regular, 13, W - 150).forEach((linha, i) => centralizado(page, linha, H - 304 - i * 20, regular, 13, CINZA));

  centralizado(page, `Emitido em ${dataPorExtenso(c.emitidoEm)}.`, H - 362, regular, 11, CINZA);

  // Assinatura institucional
  const ax = 110;
  // Rubrica da coordenação (PNG com fundo transparente), centralizada sobre a linha e passando um pouco dela
  const assLargura = 190;
  const assAltura = (assinaturaPng.height / assinaturaPng.width) * assLargura;
  page.drawImage(assinaturaPng, { x: ax + (230 - assLargura) / 2, y: 107, width: assLargura, height: assAltura });
  page.drawLine({ start: { x: ax, y: 112 }, end: { x: ax + 230, y: 112 }, thickness: 0.8, color: AZUL });
  page.drawText("Tecpro Multi Ensino", { x: ax, y: 96, size: 11, font: semi, color: AZUL });
  page.drawText("Coordenação pedagógica", { x: ax, y: 82, size: 9, font: regular, color: CINZA });

  // Validação
  page.drawImage(qr, { x: W - 190, y: 56, width: 84, height: 84 });
  const vx = W - 360;
  page.drawText("Código de validação", { x: vx, y: 120, size: 8, font: regular, color: CINZA });
  page.drawText(c.codigo, { x: vx, y: 104, size: 13, font: negrito, color: AZUL });
  page.drawText("Confira a autenticidade em:", { x: vx, y: 84, size: 8, font: regular, color: CINZA });
  // Mostra só o endereço da página de validação (o código já está acima e o QR leva ao link completo),
  // para o texto não invadir o QR code.
  const urlCurta = urlValidacao.replace(/^https?:\/\//, "").replace(/\/[^/]*$/, "");
  page.drawText(urlCurta, { x: vx, y: 72, size: 8, font: regular, color: AZUL });

  return pdf.save();
}
