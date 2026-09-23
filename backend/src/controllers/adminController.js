const db = require('../config/db');
const auditoria = require('../services/auditoriaService');
const juridicoAutoService = require('../services/juridicoAutoService');
const scoreService = require('../services/scoreService');

/**
 * Apaga todos os dados de teste/importação (títulos, contratos, clientes, casos jurídicos,
 * timeline e histórico de importações), mantendo configuração (usuários, fundos, regras de
 * score, régua de cobrança e templates). Exige confirmação explícita no corpo da requisição
 * para evitar apagar dados por engano.
 */
async function resetarDadosImportacao(req, res) {
  const { confirmar } = req.body;
  if (confirmar !== 'ZERAR') {
    return res.status(400).json({
      erro: 'Confirmação necessária. Envie { "confirmar": "ZERAR" } no corpo da requisição para apagar os dados.',
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `TRUNCATE TABLE
         casos_juridicos_titulos,
         timeline_eventos,
         casos_juridicos,
         titulos,
         contratos,
         clientes,
         empreendimentos,
         importacoes
       RESTART IDENTITY CASCADE`
    );
    await client.query('COMMIT');

    await auditoria.registrar({
      usuarioId: req.usuario.id,
      acao: 'resetar_dados_importacao',
      entidade: 'sistema',
      detalhe: { motivo: 'Reset solicitado para nova carga de teste.' },
    });

    return res.json({ ok: true, mensagem: 'Dados de importação apagados. Fundos, usuários e configurações foram mantidos.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao resetar dados:', err.message);
    return res.status(500).json({ erro: 'Erro ao resetar dados.' });
  } finally {
    client.release();
  }
}

/**
 * Roda manualmente, sem precisar subir uma planilha, a verificação de encaminhamento
 * automático ao jurídico (30+ dias de atraso, e "arrasta" o resto da dívida de quem já está
 * no jurídico) seguida do recálculo de score. Útil para testar mudanças na régua sem precisar
 * reimportar a planilha de teste a cada ajuste.
 */
async function rodarReguaAgora(req, res) {
  try {
    const resultado = await juridicoAutoService.transferirAutomaticamenteParaJuridico();
    await scoreService.recalcularTodos();
    await auditoria.registrar({
      usuarioId: req.usuario.id,
      acao: 'rodar_regua_manual',
      entidade: 'sistema',
      detalhe: resultado,
    });
    return res.json({ ok: true, ...resultado, mensagem: 'Régua automática e recálculo de score executados.' });
  } catch (err) {
    console.error('Erro ao rodar régua manualmente:', err.message);
    return res.status(500).json({ erro: 'Erro ao rodar régua automática.' });
  }
}

module.exports = { resetarDadosImportacao, rodarReguaAgora };
