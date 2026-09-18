const db = require('../config/db');
const auditoria = require('../services/auditoriaService');

async function listarCasos(req, res) {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE cj.status = $1';
  }
  try {
    const { rows } = await db.query(
      `SELECT cj.*, c.nome AS cliente_nome, c.codigo_erp_cliente
       FROM casos_juridicos cj
       JOIN clientes c ON c.id = cj.cliente_id
       ${where}
       ORDER BY cj.data_encaminhamento DESC`,
      params
    );
    return res.json({ casos: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao listar casos jurídicos.' });
  }
}

async function detalheCaso(req, res) {
  const { id } = req.params;
  try {
    const casoQ = await db.query(
      `SELECT cj.*, c.nome AS cliente_nome, c.codigo_erp_cliente
       FROM casos_juridicos cj JOIN clientes c ON c.id = cj.cliente_id
       WHERE cj.id = $1`,
      [id]
    );
    if (casoQ.rows.length === 0) return res.status(404).json({ erro: 'Caso não encontrado.' });

    const titulosQ = await db.query(
      `SELECT t.* FROM casos_juridicos_titulos cjt
       JOIN titulos t ON t.id = cjt.titulo_id
       WHERE cjt.caso_id = $1`,
      [id]
    );

    return res.json({ caso: casoQ.rows[0], titulos: titulosQ.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao buscar caso.' });
  }
}

async function atualizarCaso(req, res) {
  const { id } = req.params;
  const { status, numeroProcesso, observacoes } = req.body;

  const campos = [];
  const params = [];
  let idx = 1;

  if (status) {
    campos.push(`status = $${idx++}`);
    params.push(status);
  }
  if (numeroProcesso !== undefined) {
    campos.push(`numero_processo = $${idx++}`);
    params.push(numeroProcesso);
  }
  if (observacoes !== undefined) {
    campos.push(`observacoes = $${idx++}`);
    params.push(observacoes);
  }
  campos.push(`atualizado_em = now()`);

  if (campos.length === 1) {
    return res.status(400).json({ erro: 'Nada para atualizar.' });
  }

  params.push(id);

  try {
    const { rows } = await db.query(
      `UPDATE casos_juridicos SET ${campos.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Caso não encontrado.' });

    await db.query(
      `INSERT INTO timeline_eventos (cliente_id, tipo, descricao, autor_id)
       VALUES ($1, 'judicial', $2, $3)`,
      [rows[0].cliente_id, `Caso jurídico atualizado: status = ${rows[0].status}${numeroProcesso ? `, processo ${numeroProcesso}` : ''}.`, req.usuario.id]
    );

    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'atualizar_caso_juridico', entidade: 'casos_juridicos', entidadeId: id, detalhe: req.body });

    return res.json({ caso: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar caso.' });
  }
}

module.exports = { listarCasos, detalheCaso, atualizarCaso };
