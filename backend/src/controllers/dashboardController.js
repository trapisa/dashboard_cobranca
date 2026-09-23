const db = require('../config/db');

async function resumo(req, res) {
  try {
    // Inadimplência total = 'aberto' + 'em_juridico'. Ir para o jurídico não zera a dívida do
    // cliente, só muda quem está tratando a cobrança — por isso os dois status entram aqui.
    const totalAberto = await db.query(
      `SELECT COUNT(*) AS qtd, COALESCE(SUM(valor_atualizado), 0) AS valor
       FROM titulos WHERE status IN ('aberto', 'em_juridico')`
    );

    const porEmpreendimento = await db.query(
      `SELECT e.nome, COUNT(t.id) AS qtd, COALESCE(SUM(t.valor_atualizado), 0) AS valor
       FROM titulos t
       JOIN contratos c ON c.id = t.contrato_id
       JOIN empreendimentos e ON e.id = c.empreendimento_id
       WHERE t.status IN ('aberto', 'em_juridico')
       GROUP BY e.nome
       ORDER BY valor DESC`
    );

    const porFundo = await db.query(
      `SELECT COALESCE(f.nome, 'Sem fundo mapeado') AS nome, COUNT(t.id) AS qtd, COALESCE(SUM(t.valor_atualizado), 0) AS valor
       FROM titulos t
       LEFT JOIN fundos f ON f.id = t.fundo_id
       WHERE t.status IN ('aberto', 'em_juridico')
       GROUP BY f.nome
       ORDER BY valor DESC`
    );

    const aging = await db.query(
      `SELECT
          COUNT(*) FILTER (WHERE (CURRENT_DATE - vencimento) BETWEEN 0 AND 30) AS faixa_0_30,
          COUNT(*) FILTER (WHERE (CURRENT_DATE - vencimento) BETWEEN 31 AND 60) AS faixa_30_60,
          COUNT(*) FILTER (WHERE (CURRENT_DATE - vencimento) BETWEEN 61 AND 90) AS faixa_60_90,
          COUNT(*) FILTER (WHERE (CURRENT_DATE - vencimento) > 90) AS faixa_90_mais,
          COALESCE(SUM(valor_atualizado) FILTER (WHERE (CURRENT_DATE - vencimento) BETWEEN 0 AND 30), 0) AS valor_0_30,
          COALESCE(SUM(valor_atualizado) FILTER (WHERE (CURRENT_DATE - vencimento) BETWEEN 31 AND 60), 0) AS valor_30_60,
          COALESCE(SUM(valor_atualizado) FILTER (WHERE (CURRENT_DATE - vencimento) BETWEEN 61 AND 90), 0) AS valor_60_90,
          COALESCE(SUM(valor_atualizado) FILTER (WHERE (CURRENT_DATE - vencimento) > 90), 0) AS valor_90_mais
       FROM titulos WHERE status IN ('aberto', 'em_juridico')`
    );

    const evolucaoMensal = await db.query(
      `SELECT to_char(date_trunc('month', criado_em), 'YYYY-MM') AS mes,
              COUNT(*) FILTER (WHERE status != 'baixado') AS novos,
              COUNT(*) FILTER (WHERE status = 'baixado') AS baixados
       FROM titulos
       WHERE criado_em > now() - interval '12 months'
       GROUP BY mes
       ORDER BY mes`
    );

    const porEncaminhamento = await db.query(
      `SELECT
          COUNT(*) FILTER (WHERE status = 'aberto') AS cobranca_amigavel,
          COUNT(*) FILTER (WHERE status = 'em_juridico') AS juridico
       FROM titulos`
    );

    const rankingClientes = await db.query(
      `SELECT c.id, c.nome, c.score_atual, c.faixa_prioridade,
              COALESCE(SUM(t.valor_atualizado), 0) AS valor_em_aberto
       FROM clientes c
       JOIN contratos ct ON ct.cliente_id = c.id
       JOIN titulos t ON t.contrato_id = ct.id AND t.status IN ('aberto', 'em_juridico')
       GROUP BY c.id, c.nome, c.score_atual, c.faixa_prioridade
       ORDER BY c.score_atual DESC, valor_em_aberto DESC
       LIMIT 20`
    );

    return res.json({
      inadimplenciaTotal: totalAberto.rows[0],
      porEmpreendimento: porEmpreendimento.rows,
      porFundo: porFundo.rows,
      aging: aging.rows[0],
      evolucaoMensal: evolucaoMensal.rows,
      porEncaminhamento: porEncaminhamento.rows[0],
      rankingClientes: rankingClientes.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao montar dashboard.' });
  }
}

module.exports = { resumo };
