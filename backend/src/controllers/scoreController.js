const db = require('../config/db');
const auditoria = require('../services/auditoriaService');
const scoreService = require('../services/scoreService');

async function listarRegras(req, res) {
  const { rows } = await db.query('SELECT * FROM score_regras ORDER BY criado_em');
  return res.json({ regras: rows });
}

async function criarRegra(req, res) {
  const { descricao, condicao, pontos, ativa } = req.body;
  if (!descricao || !condicao || pontos === undefined) {
    return res.status(400).json({ erro: 'Informe descrição, condição e pontos.' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO score_regras (descricao, condicao, pontos, ativa) VALUES ($1, $2, $3, $4) RETURNING *',
      [descricao, JSON.stringify(condicao), pontos, ativa !== false]
    );
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'criar_regra_score', entidade: 'score_regras', entidadeId: rows[0].id });
    scoreService.recalcularTodos().catch((e) => console.error('Erro ao recalcular scores:', e.message));
    return res.status(201).json({ regra: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar regra de score.' });
  }
}

async function atualizarRegra(req, res) {
  const { id } = req.params;
  const { descricao, condicao, pontos, ativa } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE score_regras SET descricao = $1, condicao = $2, pontos = $3, ativa = $4 WHERE id = $5 RETURNING *',
      [descricao, JSON.stringify(condicao), pontos, ativa !== false, id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Regra não encontrada.' });
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'editar_regra_score', entidade: 'score_regras', entidadeId: id });
    scoreService.recalcularTodos().catch((e) => console.error('Erro ao recalcular scores:', e.message));
    return res.json({ regra: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar regra.' });
  }
}

async function removerRegra(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM score_regras WHERE id = $1', [id]);
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'remover_regra_score', entidade: 'score_regras', entidadeId: id });
    scoreService.recalcularTodos().catch((e) => console.error('Erro ao recalcular scores:', e.message));
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao remover regra.' });
  }
}

module.exports = { listarRegras, criarRegra, atualizarRegra, removerRegra };
