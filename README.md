# Site Tecpro Multi Ensino

Site de vendas e área do aluno da Tecpro, com os cursos vindos da API da Escola Avançada.
Plano completo em [docs/PLANO.md](docs/PLANO.md).

## Rodar no computador
```bash
npm install
npm run dev      # abre em http://localhost:3000
```

Sem a chave da API, o site mostra **cursos de exemplo** (`src/lib/escola-avancada/mock.ts`).
Para usar os cursos reais, copie `.env.example` para `.env.local` e preencha a URL e o token.

## Onde mexer
- Cores da marca: `src/app/globals.css`
- Logo: `public/logo-tecpro-transparente.png` (para fundo escuro) e `public/logo-tecpro.png` (original)
- Conexão com a API: `src/lib/escola-avancada/` (o formato dos campos ainda é suposição, conferir com a resposta real)

## Pagamentos (Asaas)
Sem `ASAAS_API_KEY`, o checkout funciona em **modo de teste** (simulador, nada é cobrado).
Para ligar o Asaas:
1. No Asaas, gere a chave de API (comece pela conta **sandbox**, de testes).
2. Coloque `ASAAS_API_KEY`, `ASAAS_AMBIENTE` e `ASAAS_WEBHOOK_TOKEN` nas variáveis de ambiente da hospedagem (Vercel). Nunca no código.
3. No Asaas, em Integrações > Webhooks, cadastre `https://SEU-DOMINIO/api/webhooks/asaas` com o mesmo token, eventos de pagamento confirmado/recebido.

Quando o pagamento é confirmado, o site cria o aluno na Escola Avançada, libera o curso e dispara o e-mail de acesso (`src/lib/pagamentos/liberacao.ts`).
Regras de parcelamento: `src/lib/config-loja.ts`.
