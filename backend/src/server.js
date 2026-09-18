require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');

const app = express();

app.use(helmet());

// Em produção, restringe o CORS ao(s) domínio(s) do frontend (ex.: seu domínio no
// Cloudflare Pages). Se FRONTEND_URL não for definida, libera qualquer origem
// (cômodo em desenvolvimento, mas defina a variável em produção).
const origensPermitidas = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    origensPermitidas.length > 0
      ? { origin: origensPermitidas }
      : {}
  )
);

app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', routes);

// Tratamento de erros do multer / gerais
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    const status = err.status || 400;
    return res.status(status).json({ erro: err.message || 'Erro inesperado.' });
  }
  next();
});

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CRM de Cobrança Trapisa - backend rodando na porta ${PORT}`);
});
