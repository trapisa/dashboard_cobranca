const db = require('../config/db');

async function registrar({ usuarioId, acao, entidade, entidadeId, detalhe }) {
  try {
    await db.query(
      `INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhe)
       VALUES ($1, $2, $3, $4, $5)`,
      [usuarioId || null, acao, entidade || null, entidadeId || null, detalhe ? JSON.stringify(detalhe) : null]
    );
  } catch (err) {
    // Auditoria não deve travar o fluxo principal
    console.error('Falha ao registrar auditoria:', err.message);
  }
}

module.exports = { registrar };
