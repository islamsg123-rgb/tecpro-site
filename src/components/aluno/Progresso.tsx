export function BarraProgresso({ pct, claro = false }: { pct: number; claro?: boolean }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${claro ? "bg-white/15" : "bg-slate-100"}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-laranja-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AnelProgresso({ pct, tamanho = 120 }: { pct: number; tamanho?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} aria-label={`${pct}% concluído`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke="#ffa500" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 60 60)"
      />
      <text x="60" y="66" textAnchor="middle" className="fill-white font-display" fontSize="24" fontWeight="700">{pct}%</text>
    </svg>
  );
}
