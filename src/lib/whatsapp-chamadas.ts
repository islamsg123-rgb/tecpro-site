import "server-only";
import { bancoEmDemonstracao, db } from "./dados";

/**
 * Registro de quando o painel chamou um aluno no WhatsApp para pagar o certificado.
 * Guardado no banco (configuracoes_loja, chave "whatsapp_chamadas_certificado"), sem tabela nova:
 * vale em qualquer aparelho e para todos os funcionários do painel.
 * Formato: { "email|cursoId": ["2026-11-27T19:00:00.000Z", ...] } (as últimas vezes, a mais recente no fim).
 */

const CHAVE = "whatsapp_chamadas_certificado";
const GUARDAR_POR_ALUNO = 10;
type Registro = Record<string, string[]>;
const g = globalThis as unknown as { __chamadasDemo?: Registro };

export const chaveChamada = (email: string, cursoId: string) => `${email.trim().toLowerCase()}|${cursoId}`;

async function ler(): Promise<Registro> {
  if (bancoEmDemonstracao) return (g.__chamadasDemo ??= process.env.FOTOS_DEMO ? {
    "carlos.mendes@gmail.com|203": [new Date(Date.now() - 50 * 3600e3).toISOString()],
    "paulo.santos@gmail.com|205": [new Date(Date.now() - 80 * 3600e3).toISOString(), new Date(Date.now() - 26 * 3600e3).toISOString()],
  } : {});
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", CHAVE).maybeSingle();
  if (error) throw error;
  return (data?.valor as Registro | null) ?? {};
}

/** Todas as chamadas, por "email|cursoId". */
export async function listarChamadasCertificado(): Promise<Map<string, string[]>> {
  const r = await ler().catch((e) => {
    console.error("[whatsapp-chamadas]", e instanceof Error ? e.message : e);
    return {} as Registro;
  });
  return new Map(Object.entries(r));
}

/** Anota que o aluno foi chamado agora. Devolve as vezes registradas. */
export async function registrarChamadaCertificado(email: string, cursoId: string): Promise<string[]> {
  const r = await ler();
  const k = chaveChamada(email, cursoId);
  const vezes = [...(r[k] ?? []), new Date().toISOString()].slice(-GUARDAR_POR_ALUNO);
  r[k] = vezes;
  if (bancoEmDemonstracao) return vezes;
  const { error } = await db().from("configuracoes_loja").upsert({ chave: CHAVE, valor: r, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
  return vezes;
}
