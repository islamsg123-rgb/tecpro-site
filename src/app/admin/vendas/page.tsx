import { redirect } from "next/navigation";

/** "Vendas" agora reúne carrinhos, cupons e pesquisa; a lista de pagamentos fica no Financeiro. */
export default function Vendas() {
  redirect("/admin/carrinhos");
}
