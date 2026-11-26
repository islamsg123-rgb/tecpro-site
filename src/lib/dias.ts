/**
 * Contas de dias do painel: sempre pelo calendário no horário de Brasília (Belém usa o mesmo horário).
 * O dia vira à meia-noite, e não "24 horas depois".
 */
const FUSO = "America/Sao_Paulo";
const DIA = 86_400_000;

/** "AAAA-MM-DD" do dia no horário de Brasília. */
export function diaBR(d: Date | string | number = Date.now()): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: FUSO });
}

function numeroDoDia(d: Date | string | number): number {
  const [a, m, dia] = diaBR(d).split("-").map(Number);
  return Date.UTC(a, m - 1, dia) / DIA;
}

/** Dias de calendário desde uma data (null = nunca): 0 = hoje, 1 = ontem. */
export function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, numeroDoDia(Date.now()) - numeroDoDia(iso));
}

/** Meia-noite (horário de Brasília) do começo dos "últimos N dias", contando hoje como 1 (ISO). */
export function inicioUltimosDias(n: number): string {
  const hoje = numeroDoDia(Date.now());
  const d = new Date((hoje - (n - 1)) * DIA).toISOString().slice(0, 10);
  return new Date(`${d}T00:00:00-03:00`).toISOString();
}
