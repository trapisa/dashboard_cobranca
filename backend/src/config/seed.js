const bcrypt = require('bcryptjs');
const { pool } = require('./db');
require('dotenv').config();

async function seed() {
  const nome = process.env.SEED_ADMIN_NOME || 'Administrador';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@trapisa.com.br';
  const senha = process.env.SEED_ADMIN_SENHA || 'troque_esta_senha';

  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existente.rows.length > 0) {
      console.log(`Usuário admin (${email}) já existe. Nada a fazer.`);
      return;
    }
    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES ($1, $2, $3, 'admin', true)`,
      [nome, email, senhaHash]
    );
    console.log(`Usuário admin criado: ${email}`);
    console.log('IMPORTANTE: troque a senha padrão assim que possível.');
  } catch (err) {
    console.error('Erro ao criar usuário admin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
