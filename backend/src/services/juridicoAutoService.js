const db = require('../config/db');

const DIAS_LIMITE_JURIDICO_AUTOMATICO = 30;

/**
 * Verifica todos os títulos 'aberto' com dias de atraso >= DIAS_LIMITE_JURIDICO_AUTOMATICO
 * e encaminha automaticamente o cliente ao jurídico (mesma ação que o botão manual faz),
 * registrando na timeline que foi automático. Roda depois de cada importação.
 */
async function transferirAutomaticamenteParaJuridico() {
  const client = await db.pool.connect();
  let clientesTransferidos = 0;
  try {
    const titulosVencidos = await client.query(
      `SELECT t.id AS titulo_id, ct.cliente_id
       FROM titulos t
       JOIN contratos ct ON ct.id = t.contrato_id
       WHERE t.status = 'aberto' AND (CURRENT_DATE - t.vencimento) >= $1`,
      [DIAS_LIMITE_JURIDICO_AUTOMATICO]
    );

    if (titulosVencidos.rows.length === 0) return { clientesTransferidos: 0 };

    // Agrupa títulos por cliente
    const porCliente = new Map();
    for (const row of titulosVencidos.rows) {
      if (!porCliente.has(row.cliente_id)) porCliente.set(row.cliente_id, []);
      porCliente.get(row.cliente_id).push(row.titulo_id);
    }

    for (const [clienteId, tituloIds] of porCliente.entries()) {
      await client.query('BEGIN');
      try {
        const casoQ = await client.query(
          `INSERT INTO casos_juridicos (cliente_id, status, observacoes, criado_por)
           VALUES ($1, 'encaminhado', $2, NULL) RETURNING id`,
          [
            clienteId,
            `Encaminhado automaticamente pela régua de cobrança: título(s) com ${DIAS_LIMITE_JURIDICO_AUTOMATICO}+ dias de atraso.`,
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
            `Cliente encaminhado automaticamente ao jurídico pela régua de cobrança (${tituloIds.length} título(s) com ${DIAS_LIMITE_JURIDICO_AUTOMATICO}+ dias de atraso).`,
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