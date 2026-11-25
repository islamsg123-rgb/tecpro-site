/**
 * Endereço para mostrar um vídeo dentro do site (iframe), a partir do link colado no painel.
 * Aceita Panda (player-*.tv.pandavideo.com.br/embed/?v=...) e YouTube (watch, youtu.be, shorts, embed).
 * null = link não reconhecido.
 */
export function enderecoVideo(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host.endsWith(".pandavideo.com.br")) return u.toString();
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? "";
  } else if (host === "youtube-nocookie.com") id = u.pathname.match(/^\/embed\/([^/]+)/)?.[1] ?? "";
  return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}
