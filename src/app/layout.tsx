import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { AvisoDadosExemplo } from "@/components/AvisoDadosExemplo";
import { BarraCarregamento } from "@/components/carregando/BarraCarregamento";

const titulo = Poppins({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--fonte-titulo" });
const texto = Inter({ subsets: ["latin"], variable: "--fonte-texto" });

export const metadata: Metadata = {
  title: { default: "Tecpro Multi Ensino | Cursos online com certificado", template: "%s | Tecpro Multi Ensino" },
  description: "Cursos online para você aprender no seu ritmo e conquistar seu certificado.",
  icons: { icon: "/icone.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <BarraCarregamento />
        <AvisoDadosExemplo />
        <Cabecalho />
        <main className="flex-1">{children}</main>
        <Rodape />
      </body>
    </html>
  );
}
