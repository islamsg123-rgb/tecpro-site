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
