# Plano do site Tecpro

## Tecnologia escolhida
- **Next.js + React + TypeScript**: site rápido, bom para Google (SEO) e com "parte de servidor" embutida, onde ficam a chave da API e o pagamento, longe do navegador do visitante.
- **Tailwind CSS**: visual próprio da Tecpro, fácil de ajustar cores e espaçamentos.
- **Hospedagem**: Vercel (plano grátis serve para começar; publica sozinho a cada mudança aprovada).
- **Banco de dados** (a partir da etapa 3): Postgres (ex.: Supabase) para alunos, progresso e certificados.
- **Pagamento** (etapa 2): Asaas ou Mercado Pago, com checkout transparente (Pix, boleto, cartão dentro do site).

## Etapas
1. **Vitrine de cursos** (esta etapa): página inicial, catálogo com busca e filtros, página de vendas de cada curso. Dados de exemplo no formato da API da Escola Avançada.
2. **Checkout** (feito, aguardando chave do Asaas): pagamento transparente; ao confirmar, o site cria o aluno e libera o curso na Escola Avançada pela API.
3. **Área do aluno** (feito, aguardando conta no Supabase): login, "Meus cursos", progresso.
4. **Página de aula**: vídeo do Vimeo embutido e progresso marcado pelo site. *Depende dos IDs do Vimeo e da liberação do domínio, pedidos à Escola Avançada.*
5. **Certificado** (feito): gerado pelo site em PDF, com código de validação; configurável por curso como grátis ao concluir ou pago.
6. **Painel administrativo**: preços, destaques, configuração de certificado, vendas.
7. **Publicação**: domínio próprio, testes finais.

## Pendências externas
- Chave (token) e endereço da API da Escola Avançada.
- IDs dos vídeos no Vimeo por aula e liberação do domínio da Tecpro no Vimeo.
- Contatos oficiais (WhatsApp, e-mail) para o rodapé.
