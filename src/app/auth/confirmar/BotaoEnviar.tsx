"use client";

import { useFormStatus } from "react-dom";

export function BotaoEnviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-8 flex w-full items-center justify-center rounded-full bg-laranja-500 py-4 font-bold text-marca-900 transition hover:bg-laranja-400 disabled:opacity-70"
    >
      {pending ? "Entrando…" : children}
    </button>
  );
}
