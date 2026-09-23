const db = require('../config/db');

const DIAS_LIMITE_JURIDICO_AUTOMATICO = 30;

/**
 * Roda depois de cada importação. Dois grupos de cliente entram na varredura:
 *
 * 1. Clientes com título 'aberto' que atingiu DIAS_LIMITE_JURIDICO_AUTOMATICO dias de atraso
 *    (o gatilho original).
 * 2. Clientes que JÁ têm algum caso jurídico (de qualquer momento, manual ou automático).
 *    Uma vez que o cliente está no jurídico, qualquer outra parcela dele que esteja vencida
 *    — mesmo com poucos dias de atraso — é encaminhada junto. Não faz sentido jurídico
 *    "fatiar" a dívida de uma pessoa por parcela; se ela está lá, a dívida toda acompanha,
 *    incluindo parcelas que vencerem depois (a cada nova importação).
 *
 * Para os dois grupos, a ação é a mesma: qualquer título 'aberto' já vencido (vencimento <
 * hoje) desse cliente é encaminhado — não só os que passaram dos 30 dias.
 */
async function transferirAutomaticamenteParaJuridico() {
  const client = await db.pool.connect();
  let clientesTransferidos = 0;
  try {
    const candidatosQ = await client.query(
      `SELECT DISTINCT ct.cliente_id
       FROM titulos t
       JOIN contratos ct ON ct.id = t.contrato_id
       WHERE t.status = 'aberto' AND (CURRENT_DATE - t.vencimento) >= $1

       UNION

       SELECT DISTINCT cj.cliente_id
       FROM casos_juridicos cj`,
      [DIAS_LIMITE_JURIDICO_AUTOMATICO]
    );

    if (candidatosQ.rows.length === 0) return { clientesTransferidos: 0 };

    for (const { cliente_id: clienteId } of candidatosQ.rows) {
      await client.query('BEGIN');
      try {
        // Todo título 'aberto' já vencido (qualquer atraso) desse cliente vai junto.
        const titulosQ = await client.query(
          `SELECT t.id
           FROM titulos t
           JOIN contratos ct ON ct.id = t.contrato_id
           WHERE ct.cliente_id = $1 AND t.status = 'aberto' AND t.vencimento < CURRENT_DATE`,
          [clienteId]
        );

        if (titulosQ.rows.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }

        const tituloIds = titulosQ.rows.map((r) => r.id);

        const casoQ = await client.query(
          `INSERT INTO casos_juridicos (cliente_id, status, observacoes, criado_por)
           VALUES ($1, 'encaminhado', $2, NULL) RETURNING id`,
          [
            clienteId,
            `Encaminhado automaticamente pela régua de cobrança: título(s) vencido(s) (cliente já em jurídico ou atingiu ${DIAS_LIMITE_JURIDICO_AUTOMATICO}+ dias de atraso).`,
          ]
        );
        const casoId = casoQ.rows[0].id;

        for (const tituloId of tituloIds) {
          await client.query('INSERT INTO casos_juridicos_titulos (caso_id, titulo_id) VALUES ($1, $2)', [
            casoId,
            tituloId,
          ]);
          await client.query(`UPDATE titulos SET status = 'em_juridico', atualizado_em = now() WHERE id = $1`, [
            tituloId,
          ]);
        }

        await client.query(
          `INSERT INTO timeline_eventos (cliente_id, tipo, descricao)
           VALUES ($1, 'encaminhamento', $2)`,
          [
            clienteId,
            `Cliente encaminhado automaticamente ao jurídico pela régua de cobrança (${tituloIds.length} título(s) vencido(s)).`,
          ]
        );

        await client.query('COMMIT');
        clientesTransferidos++;
      } catch (errCliente) {
        await client.query('ROLLBACK');
        console.error(`Erro ao transferir cliente ${clienteId} automaticamente ao jurídico:`, errCliente.message);
      }
    }

    if (clientesTransferidos > 0) {
      console.log(`[juridico-automatico] ${clientesTransferidos} cliente(s) encaminhado(s) automaticamente ao jurídico.`);
    }

    return { clientesTransferidos };
  } finally {
    client.release();
  }
}

module.exports = { transferirAutomaticamenteParaJuridico, DIAS_LIMITE_JURIDICO_AUTOMATICO };
