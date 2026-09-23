const db = require('../config/db');
const auditoria = require('../services/auditoriaService');
const scoreService = require('../services/scoreService');

async function listar(req, res) {
  const { busca, faixa } = req.query;
  const condicoes = [];
  const params = [];

  if (busca) {
    params.push(`%${busca}%`);
    condicoes.push(`(c.nome ILIKE $${params.length} OR c.codigo_erp_cliente ILIKE $${params.length})`);
  }
  if (faixa) {
    params.push(faixa);
    condicoes.push(`c.faixa_prioridade = $${params.length}`);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  try {
    // Inadimplência total considera títulos 'aberto' e 'em_juridico' — encaminhar ao jurídico
    // não faz o cliente deixar de estar inadimplente, só muda quem está tratando a cobrança.
    const { rows } = await db.query(
      `SELECT c.id, c.codigo_erp_cliente, c.nome, c.score_atual, c.faixa_prioridade,
              COALESCE(SUM(t.valor_atualizado) FILTER (WHERE t.status IN ('aberto', 'em_juridico')), 0) AS valor_em_aberto,
              COUNT(t.id) FILTER (WHERE t.status IN ('aberto', 'em_juridico')) AS qtd_titulos_aberto
       FROM clientes c
       LEFT JOIN contratos ct ON ct.cliente_id = c.id
       LEFT JOIN titulos t ON t.contrato_id = ct.id
       ${where}
       GROUP BY c.id
       ORDER BY c.score_atual DESC, valor_em_aberto DESC`,
      params
    );
    return res.json({ clientes: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao listar clientes.' });
  }
}

async function ficha(req, res) {
  const { id } = req.params;
  try {
    const clienteQ = await db.query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (clienteQ.rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    const cliente = clienteQ.rows[0];

    const contratosQ = await db.query(
      `SELECT ct.id, ct.numero_venda, e.nome AS empreendimento_nome
       FROM contratos ct
       JOIN empreendimentos e ON e.id = ct.empreendimento_id
       WHERE ct.cliente_id = $1
       ORDER BY e.nome, ct.numero_venda`,
      [id]
    );

    const contratos = [];
    for (const contrato of contratosQ.rows) {
      const titulosQ = await db.query(
        `SELECT t.id, t.numero_parcela, t.vencimento, t.valor_original, t.valor_atualizado, t.status,
                f.nome AS fundo_nome
         FROM titulos t
         LEFT JOIN fundos f ON f.id = t.fundo_id
         WHERE t.contrato_id = $1
         ORDER BY t.vencimento`,
        [contrato.id]
      );
      contratos.push({ ...contrato, titulos: titulosQ.rows });
    }

    const timelineQ = await db.query(
      `SELECT te.*, u.nome AS autor_nome
       FROM timeline_eventos te
       LEFT JOIN usuarios u ON u.id = te.autor_id
       WHERE te.cliente_id = $1
       ORDER BY te.data DESC`,
      [id]
    );

    const casosQ = await db.query('SELECT * FROM casos_juridicos WHERE cliente_id = $1 ORDER BY data_encaminhamento DESC', [id]);

    return res.json({
      cliente,
      contratos,
      timeline: timelineQ.rows,
      casosJuridicos: casosQ.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao montar ficha do cliente.' });
  }
}

async function recalcularScore(req, res) {
  try {
    const resultado = await scoreService.recalcularCliente(req.params.id);
    return res.json(resultado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao recalcular score.' });
  }
}

async function registrarEvento(req, res) {
  const { id } = req.params;
  const { tipo, descricao, tituloId } = req.body;

  if (!tipo || !descricao) {
    return res.status(400).json({ erro: 'Informe tipo e descrição do evento.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO timeline_eventos (cliente_id, titulo_id, tipo, descricao, autor_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, tituloId || null, tipo, descricao, req.usuario.id]
    );
    await auditoria.registrar({
      usuarioId: req.usuario.id,
      acao: 'registro_timeline',
      entidade: 'clientes',
      entidadeId: id,
      detalhe: { tipo, descricao },
    });
    return res.status(201).json({ evento: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao registrar evento na timeline.' });
  }
}

async function encaminharJuridico(req, res) {
  const { id } = req.params;
  const { tituloIds, observacoes } = req.body;

  if (!Array.isArray(tituloIds) || tituloIds.length === 0) {
    return res.status(400).json({ erro: 'Selecione ao menos um título para encaminhar.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const casoQ = await client.query(
      `INSERT INTO casos_juridicos (cliente_id, status, observacoes, criado_por)
       VALUES ($1, 'encaminhado', $2, $3) RETURNING *`,
      [id, observacoes || null, req.usuario.id]
    );
    const caso = casoQ.rows[0];

    for (const tituloId of tituloIds) {
      await client.query('INSERT INTO casos_juridicos_titulos (caso_id, titulo_id) VALUES ($1, $2)', [caso.id, tituloId]);
      await client.query(`UPDATE titulos SET status = 'em_juridico', atualizado_em = now() WHERE id = $1`, [tituloId]);
    }

    await client.query(
      `INSERT INTO timeline_eventos (cliente_id, tipo, descricao, autor_id)
       VALUES ($1, 'encaminhamento', $2, $3)`,
      [id, `Cliente encaminhado ao jurídico (${tituloIds.length} título(s)).`, req.usuario.id]
    );

    await client.query('COMMIT');

    await auditoria.registrar({
      usuarioId: req.usuario.id,
      acao: 'encaminhar_juridico',
      entidade: 'casos_juridicos',
      entidadeId: caso.id,
      detalhe: { tituloIds },
    });

    // Recalcula score pois "ja_em_juridico" muda
    await scoreService.recalcularCliente(id);

    return res.status(201).json({ caso });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao encaminhar cliente ao jurídico.' });
  } finally {
    client.release();
  }
}

module.exports = { listar, ficha, recalcularScore, registrarEvento, encaminharJuridico };
