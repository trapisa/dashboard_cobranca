# Deploy gratuito — Render + Neon + Cloudflare Pages

Guia passo a passo para publicar o CRM de Cobrança Trapisa sem custo de infraestrutura.
Combo: **Neon** (PostgreSQL) + **Render** (backend Node/Express) + **Cloudflare Pages** (frontend React).

Pré-requisito: o projeto precisa estar num repositório Git (GitHub, GitLab ou Bitbucket) —
tanto o Render quanto o Cloudflare Pages fazem deploy a partir de um repositório.

---

## 1. Banco de dados — Neon (gratuito)

1. Crie uma conta em https://neon.tech (sem cartão de crédito).
2. Crie um novo projeto, região mais próxima do Brasil disponível (ex.: `sa-east-1`, se
   houver, ou a mais próxima).
3. No painel do projeto, copie a **Connection string** (algo como
   `postgresql://usuario:senha@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require`).
   Se quiser, renomeie o banco para `crm_cobranca_trapisa` nas configurações do projeto.
4. Guarde essa string — ela vai virar a variável `DATABASE_URL` no Render.
5. Rode a migração e o seed **a partir do seu computador**, apontando para o Neon (o Render
   free não tem acesso a shell/jobs, então isso é feito localmente uma única vez):

   ```bash
   cd backend
   cp .env.example .env
   # cole a connection string do Neon em DATABASE_URL no .env
   # defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA no .env
   npm install
   npm run migrate
   npm run seed
   ```

   Depois disso, o banco no Neon já está com as tabelas e o usuário admin criados.

---

## 2. Backend — Render (gratuito)

1. Suba o projeto para um repositório Git (GitHub, por exemplo), se ainda não estiver.
2. Crie uma conta em https://render.com.
3. No painel, clique em **New +** → **Blueprint**, conecte o repositório. O Render vai
   detectar o arquivo `render.yaml` na raiz do projeto e sugerir criar o serviço
   `crm-cobranca-trapisa-backend`.
4. Antes de confirmar, preencha as variáveis marcadas como "cole aqui" no `render.yaml`:
   - `DATABASE_URL`: a connection string do Neon (a mesma usada no passo 1).
   - `FRONTEND_URL`: deixe em branco por agora — você volta aqui depois que tiver a URL
     do Cloudflare Pages (passo 3).
   - `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA`: só para referência, já
     que o seed foi rodado localmente; pode repetir os mesmos valores.
5. Confirme a criação. O Render vai instalar as dependências (`npm install`) e rodar
   `npm start`. Isso leva alguns minutos na primeira vez.
6. Quando o deploy terminar, o Render mostra a URL pública do serviço, algo como
   `https://crm-cobranca-trapisa-backend.onrender.com`. Teste em
   `https://.../health` — deve responder `{"status":"ok"}`.

**Sobre o "sleep" do plano free:** o serviço dorme após ~15 minutos sem receber
requisições, e a primeira chamada depois disso demora alguns segundos para acordar.
Para um sistema de uso interno isso é normal — só avise a equipe que a primeira tela do
dia pode demorar um pouco mais para carregar.

---

## 3. Frontend — Cloudflare Pages (gratuito)

1. Crie uma conta em https://dash.cloudflare.com (aba **Workers & Pages**).
2. Clique em **Create application** → **Pages** → **Connect to Git**, e selecione o
   mesmo repositório.
3. Configure o build:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Em **Environment variables**, adicione:
   - `VITE_API_URL` = `https://crm-cobranca-trapisa-backend.onrender.com/api`
     (troque pela URL real que o Render te deu no passo 2).
5. Clique em **Save and Deploy**. Em 1–2 minutos o Cloudflare te dá uma URL do tipo
   `https://crm-cobranca-trapisa.pages.dev`.

O arquivo `frontend/public/_redirects` (já incluso no projeto) garante que as rotas do
React Router (`/clientes`, `/clientes/:id`, etc.) funcionem corretamente nesse tipo de
hospedagem estática.

---

## 4. Fechar o ciclo do CORS

Agora que você tem a URL do Cloudflare Pages, volte ao painel do Render:

1. Abra o serviço `crm-cobranca-trapisa-backend` → **Environment**.
2. Edite `FRONTEND_URL` e coloque a URL do Cloudflare Pages (ex.:
   `https://crm-cobranca-trapisa.pages.dev`). Se depois você configurar um domínio
   próprio, pode colocar as duas URLs separadas por vírgula.
3. Salve — o Render reinicia o serviço automaticamente com a nova variável.

---

## 5. Testando

1. Abra a URL do Cloudflare Pages.
2. Faça login com o e-mail/senha definidos no seed (passo 1).
3. Troque a senha padrão em **Configurações → Usuários** assim que possível.
4. Envie a primeira planilha em **Importação** e confira o dashboard.

---

## Atualizações futuras

- **Backend:** qualquer `git push` no branch conectado ao Render dispara um novo deploy
  automático.
- **Frontend:** o mesmo vale para o Cloudflare Pages.
- **Banco de dados:** mudanças de schema (novas colunas, tabelas) exigem rodar
  `npm run migrate` de novo, localmente, apontando para o Neon — ou adaptar o script de
  migração para ser incremental, se o projeto crescer bastante.

## Se o volume crescer e o free tier não for mais suficiente

- Neon: o plano free tem ~512MB de storage. Se passar disso, o upgrade é pago mas barato
  para o volume desse projeto.
- Render: se o "sleep" do plano free começar a incomodar (uso mais intenso, vários
  usuários simultâneos), o plano pago mais barato remove o sleep.
- Nenhuma dessas mudanças exige reescrever código — só trocar de plano nas mesmas
  plataformas.
