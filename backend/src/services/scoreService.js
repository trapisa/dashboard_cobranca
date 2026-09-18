const db = require('../config/db');

function faixaPor(pontos) {
  if (pontos >= 61) return 'alta';
  if (pontos >= 31) return 'media';
  return 'baixa';
}

/**
 * Calcula os "fatos" de um cliente usados como campos nas condições de score.
 */
async function calcularFatosCliente(clienteId) {
  const { rows } = await db.query(
    `SELECT
        COALESCE(SUM(t.valor_atualizado), 0) AS valor_total_em_aberto,
        COALESCE(MAX(GREATEST(0, (CURRENT_DATE - t.vencimento))), 0) AS dias_atraso
     FROM titulos t
     JOIN contratos c ON c.id = t.contrato_id
     WHERE c.cliente_id = $1 AND t.status = 'aberto'`,
    [clienteId]
  );

  const negociacaoQuebrada = await db.query(
    `SELECT COUNT(*) FROM timeline_eventos WHERE cliente_id = $1 AND tipo = 'negociacao' AND descricao ILIKE '%quebrada%'`,
    [clienteId]
  );

  const jaEmJuridico = await db.query(
    `SELECT COUNT(*) FROM casos_juridicos WHERE cliente_id = $1`,
    [clienteId]
  );

  return {
    dias_atraso: Number(rows[0].dias_atraso) || 0,
    valor_total_em_aberto: Number(rows[0].valor_total_em_aberto) || 0,
    possui_negociacao_quebrada: Number(negociacaoQuebrada.rows[0].count) > 0,
    ja_em_juridico: Number(jaEmJuridico.rows[0].count) > 0,
  };
}

function avaliarCondicao(condicao, fatos) {
  const valorCampo = fatos[condicao.campo];
  if (valorCampo === undefined) return false;
  switch (condicao.operador) {
    case '>':
      return valorCampo > condicao.valor;
    case '>=':
      return valorCampo >= condicao.valor;
    case '<':
      return valorCampo < condicao.valor;
    case '<=':
      return valorCampo <= condicao.valor;
    case '=':
    case '==':
      return valorCampo === condicao.valor;
    case '!=':
      return valorCampo !== condicao.valor;
    default:
      return false;
  }
}

async function recalcularCliente(clienteId) {
  const { rows: regras } = await db.query('SELECT * FROM score_regras WHERE ativa = true');
  const fatos = await calcularFatosCliente(clienteId);

  let pontos = 0;
  for (const regra of regras) {
    const condicao = regra.condicao;
    if (avaliarCondicao(condicao, fatos)) {
      pontos += regra.pontos;
    }
  }

  const faixa = faixaPor(pontos);

  await db.query(
    'UPDATE clientes SET score_atual = $1, faixa_prioridade = $2, score_atualizado_em = now() WHERE id = $3',
    [pontos, faixa, clienteId]
  );

  return { pontos, faixa, fatos };
}

async function recalcularTodos() {
  const { rows } = await db.query('SELECT id FROM clientes');
  for (const c of rows) {
    await recalcularCliente(c.id);
  }
}

module.exports = { recalcularCliente, recalcularTodos, calcularFatosCliente };
