
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
 
async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: a variável DATABASE_URL não foi encontrada.');
    console.error('Verifique se existe um arquivo ".env" dentro da pasta "backend"');
    console.error('(não só o ".env.example") e se ele tem a linha DATABASE_URL=... preenchida.');
    process.exitCode = 1;
    return;
  }
 
  // Mostra o host de destino (sem expor a senha) para confirmar que é o banco certo.
  try {
    const urlMascarada = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
    console.log('Conectando em:', urlMascarada);
  } catch (_) {
    // ignora falha ao mascarar, não é crítico
  }
 
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  console.log('Aplicando schema no banco de dados...');
  try {
    await pool.query(schema);
    console.log('Migração concluída com sucesso.');
  } catch (err) {
    console.error('Erro ao aplicar migração.');
    console.error('Mensagem:', err && err.message ? err.message : '(sem mensagem)');
    console.error('Código:', err && err.code ? err.code : '(sem código)');
    console.error('Detalhe completo do erro:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
 
migrate();
 