const { Pool } = require('pg');
require('dotenv').config();

// Neon (e a maioria dos provedores gratuitos de Postgres) exige SSL.
// DATABASE_SSL=false desliga isso explicitamente (ex.: Postgres local sem SSL).
const exigirSSL = process.env.DATABASE_SSL !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: exigirSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
