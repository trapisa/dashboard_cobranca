const db = require('../config/db');
const auditoria = require('../services/auditoriaService');

// ---------- Templates de mensagem ----------
async function listarTemplates(req, res) {
  const { rows } = await db.query('SELECT * FROM templates_mensagem ORDER BY criado_em DESC');
  return res.json({ templates: rows });
}

async function criarTemplate(req, res) {
  const { nome, canal, assunto, corpo } = req.body;
  if (!nome || !canal || !corpo) return res.status(400).json({ erro: 'Informe nome, canal e corpo do template.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO templates_mensagem (nome, canal, assunto, corpo) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome, canal, assunto || null, corpo]
    );
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'criar_template', entidade: 'templates_mensagem', entidadeId: rows[0].id });
    return res.status(201).json({ template: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar template.' });
  }
}

async function atualizarTemplate(req, res) {
  const { id } = req.params;
  const { nome, canal, assunto, corpo } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE templates_mensagem SET nome = $1, canal = $2, assunto = $3, corpo = $4 WHERE id = $5 RETURNING *',
      [nome, canal, assunto || null, corpo, id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Template não encontrado.' });
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'editar_template', entidade: 'templates_mensagem', entidadeId: id });
    return res.json({ template: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar template.' });
  }
}

// ---------- Etapas da régua ----------
async function listarEtapas(req, res) {
  const { rows } = await db.query(
    `SELECT re.*, tm.nome AS template_nome, tm.corpo AS template_corpo, tm.assunto AS template_assunto
     FROM regua_etapas re
     LEFT JOIN templates_mensagem tm ON tm.id = re.template_id
     ORDER BY re.dias_atraso`
  );
  return res.json({ etapas: rows });
}

async function criarEtapa(req, res) {
  const { diasAtraso, canal, templateId, ativa } = req.body;
  if (diasAtraso === undefined || !canal) return res.status(400).json({ erro: 'Informe dias de atraso e canal.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO regua_etapas (dias_atraso, canal, template_id, ativa) VALUES ($1, $2, $3, $4) RETURNING *',
      [diasAtraso, canal, templateId || null, ativa !== false]
    );
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'criar_etapa_regua', entidade: 'regua_etapas', entidadeId: rows[0].id });
    return res.status(201).json({ etapa: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar etapa da régua.' });
  }
}

async function atualizarEtapa(req, res) {
  const { id } = req.params;
  const { diasAtraso, canal, templateId, ativa } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE regua_etapas SET dias_atraso = $1, canal = $2, template_id = $3, ativa = $4 WHERE id = $5 RETURNING *',
      [diasAtraso, canal, templateId || null, ativa !== false, id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Etapa não encontrada.' });
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'editar_etapa_regua', entidade: 'regua_etapas', entidadeId: id });
    return res.json({ etapa: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar etapa.' });
  }
}

async function removerEtapa(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM regua_etapas WHERE id = $1', [id]);
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'remover_etapa_regua', entidade: 'regua_etapas', entidadeId: id });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao remover etapa.' });
  }
}

/**
 * Para um cliente, indica em qual etapa da régua ele se encontra hoje,
 * com base no maior "dias_atraso" de título aberto que seja <= dias de atraso do cliente.
 * O disparo continua manual: aqui só sinalizamos a etapa sugerida.
 */
function preencherTemplate(texto, variaveis) {
  if (!texto) return texto;
  return texto
    .replace(/\{\{\s*nome_cliente\s*\}\}/gi, variaveis.nomeCliente)
    .replace(/\{\{\s*valor_devido\s*\}\}/gi, variaveis.valorDevido)
    .replace(/\{\{\s*vencimento\s*\}\}/gi, variaveis.vencimento);
}

async function etapaAtualCliente(req, res) {
  const { id } = req.params;
  try {
    const clienteQ = await db.query('SELECT nome FROM clientes WHERE id = $1', [id]);
    if (clienteQ.rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    const nomeCliente = clienteQ.rows[0].nome;

    const fatosQ = await db.query(
      `SELECT
          COALESCE(MAX(CURRENT_DATE - t.vencimento), 0) AS dias_atraso,
          COALESCE(SUM(t.valor_atualizado), 0) AS valor_total_em_aberto,
          MAX(t.vencimento) FILTER (
            WHERE (CURRENT_DATE - t.vencimento) = (
              SELECT MAX(CURRENT_DATE - t2.vencimento)
              FROM titulos t2 JOIN contratos c2 ON c2.id = t2.contrato_id
              WHERE c2.cliente_id = $1 AND t2.status = 'aberto'
            )
          ) AS vencimento_mais_atrasado
       FROM titulos t JOIN contratos c ON c.id = t.contrato_id
       WHERE c.cliente_id = $1 AND t.status = 'aberto'`,
      [id]
    );
    const diasAtraso = Number(fatosQ.rows[0].dias_atraso) || 0;
    const valorDevido = Number(fatosQ.rows[0].valor_total_em_aberto) || 0;
    const vencimentoMaisAtrasado = fatosQ.rows[0].vencimento_mais_atrasado;

    const etapaQ = await db.query(
      `SELECT re.*, tm.nome AS template_nome, tm.corpo AS template_corpo, tm.assunto AS template_assunto
       FROM regua_etapas re
       LEFT JOIN templates_mensagem tm ON tm.id = re.template_id
       WHERE re.ativa = true AND re.dias_atraso <= $1
       ORDER BY re.dias_atraso DESC
       LIMIT 1`,
      [diasAtraso]
    );

    let etapaSugerida = etapaQ.rows[0] || null;
    if (etapaSugerida) {
      const variaveis = {
        nomeCliente,
        valorDevido: valorDevido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        vencimento: vencimentoMaisAtrasado
          ? new Date(vencimentoMaisAtrasado).toLocaleDateString('pt-BR')
          : '-',
      };
      etapaSugerida = {
        ...etapaSugerida,
        template_assunto_preenchido: preencherTemplate(etapaSugerida.template_assunto, variaveis),
        template_corpo_preenchido: preencherTemplate(etapaSugerida.template_corpo, variaveis),
      };
    }

    return res.json({ diasAtraso, valorDevido, etapaSugerida });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao calcular etapa da régua.' });
  }
}

module.exports = {
  listarTemplates,
  criarTemplate,
  atualizarTemplate,
  listarEtapas,
  criarEtapa,
  atualizarEtapa,
  removerEtapa,
  etapaAtualCliente,
};