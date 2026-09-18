const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const importacaoService = require('../services/importacaoService');
const auditoria = require('../services/auditoriaService');

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO importacoes (arquivo_nome, usuario_id, status) VALUES ($1, $2, 'processando') RETURNING *`,
      [req.file.originalname, req.usuario.id]
    );
    const importacao = rows[0];

    await auditoria.registrar({
      usuarioId: req.usuario.id,
      acao: 'upload_planilha',
      entidade: 'importacoes',
      entidadeId: importacao.id,
      detalhe: { arquivo: req.file.originalname },
    });

    // Responde imediatamente e processa em background (job assíncrono simplificado).
    // Em produção, isto pode ser delegado a um worker BullMQ separado.
    res.status(202).json({ importacao });

    importacaoService
      .processarImportacao({
        importacaoId: importacao.id,
        caminhoArquivo: req.file.path,
        usuarioId: req.usuario.id,
      })
      .catch((err) => {
        console.error('Erro no processamento da importação:', err.message);
      })
      .finally(() => {
        fs.unlink(req.file.path, () => {});
      });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao iniciar importação.' });
  }
}

async function listar(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM importacoes ORDER BY data_upload DESC LIMIT 50');
    return res.json({ importacoes: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao listar importações.' });
  }
}

async function detalhe(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM importacoes WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ erro: 'Importação não encontrada.' });
    return res.json({ importacao: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao buscar importação.' });
  }
}

module.exports = { upload, listar, detalhe };
