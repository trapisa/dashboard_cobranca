# CRM de Cobrança de Inadimplentes — Grupo Trapisa

Implementação inicial conforme a documentação técnica (`crm-cobranca-trapisa.md`).
Stack 100% gratuita: Node.js + Express + PostgreSQL no backend, React (Vite) no frontend.

## Estrutura

```
crm-cobranca-trapisa/
├── backend/     # API REST (Node.js + Express + PostgreSQL)
├── frontend/    # Interface web (React + Vite)
├── render.yaml  # Blueprint de deploy do backend no Render
└── DEPLOY.md    # Passo a passo de deploy gratuito (Render + Neon + Cloudflare Pages)
```

> Quer publicar o sistema sem custo de infraestrutura? Veja **[DEPLOY.md](./DEPLOY.md)**
> — combo recomendado: Neon (Postgres) + Render (backend) + Cloudflare Pages (frontend).

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+ (na sua VPS ou local)
- (Opcional, para fila assíncrona mais robusta no futuro) Redis

## 1. Configurar o banco de dados

Crie um banco PostgreSQL vazio, por exemplo:

```sql
CREATE DATABASE crm_cobranca_trapisa;
```

## 2. Backend

```bash
cd backend
cp .env.example .env
# edite o .env com a DATABASE_URL, JWT_SECRET e dados do admin inicial
npm install
npm run migrate    # cria todas as tabelas
npm run seed       # cria o usuário admin inicial
npm run dev         # desenvolvimento (nodemon) — ou "npm start" em produção
```

O backend sobe por padrão em `http://localhost:3001`. Rota de health check: `GET /health`.

### Importante sobre a fila assíncrona

A documentação prevê `bullmq` + Redis para o processamento em background do upload de
planilha. Nesta primeira versão, o processamento roda de forma assíncrona simples dentro
do próprio processo Node (a resposta HTTP volta imediatamente e o processamento continua
em background). Isso funciona bem para o volume atual (~2.500 linhas) sem exigir Redis.
Se o volume crescer muito ou for necessário escalar workers separadamente, o próximo passo
é mover `processarImportacao` (em `src/services/importacaoService.js`) para um worker
BullMQ dedicado.

## 3. Frontend

```bash
cd frontend
cp .env.example .env
# ajuste VITE_API_URL se o backend não estiver em localhost:3001
npm install
npm run dev          # desenvolvimento (http://localhost:5173)
npm run build         # gera build de produção em dist/
```

Em produção, sirva o conteúdo de `frontend/dist` por qualquer servidor estático (Nginx,
por exemplo) e aponte para a API do backend.

## 4. Primeiro acesso

Use o e-mail e senha definidos em `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA` no `.env` do
backend (executados via `npm run seed`). Troque a senha assim que possível — ainda não
há tela de "esqueci minha senha"; a troca deve ser feita pelo próprio admin em
Configurações > Usuários, ou diretamente no banco.

## O que já está implementado

- **Autenticação** JWT + bcrypt, com 4 perfis (admin, cobrança, jurídico, diretoria/consulta).
- **Importação de planilha** (.xlsx) com validação de colunas obrigatórias, diff
  (novo/atualizado/baixado automático), resolução de empreendimento/cliente/contrato/fundo,
  relatório de erros por linha e fundos não mapeados.
- **Dashboard** com inadimplência total, quebra por empreendimento e por fundo, aging
  (0-30/30-60/60-90/90+), evolução mensal, contagem por encaminhamento e ranking de
  clientes por score.
- **Ficha do cliente**: dados cadastrais, contratos e títulos, timeline completa,
  botão "Encaminhar ao Jurídico", indicação da etapa da régua sugerida para hoje.
- **Régua de cobrança configurável** (etapas por dias de atraso + canal + template),
  com disparo manual — o sistema apenas sinaliza a etapa, a equipe decide e registra o
  contato na timeline.
- **Score de recuperabilidade** com motor de regras configurável (campo/operador/valor
  → pontos), recalculado a cada importação ou sob demanda.
- **Módulo jurídico** com fila de casos, atualização manual de status/nº de processo/
  observações (sem integração com o sistema de sincronização TJSP, como definido no
  documento).
- **Auditoria** de ações relevantes (login, upload, mudanças de status, encaminhamentos,
  edição de regra/template) em tabela própria.

## O que ainda depende de decisão/trabalho futuro (conforme o próprio documento)

- Política de retenção de dados de títulos baixados/quitados (LGPD) — a definir com o
  jurídico interno.
- Envio efetivo das mensagens da régua (hoje o sistema só sinaliza a etapa; a equipe
  copia o template e dispara pelo canal que já usa — WhatsApp Business, e-mail, etc.).
  Se depois quiserem automatizar o disparo, dá para integrar uma API de WhatsApp/e-mail
  nesse ponto.
- Fila assíncrona dedicada com BullMQ/Redis, caso o volume de linhas cresça muito.
