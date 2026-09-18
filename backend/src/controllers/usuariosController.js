const bcrypt = require('bcryptjs');
const db = require('../config/db');
const auditoria = require('../services/auditoriaService');

async function listar(req, res) {
  const { rows } = await db.query('SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome');
  return res.json({ usuarios: rows });
}

async function criar(req, res) {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ erro: 'Informe nome, email, senha e perfil.' });
  }
  if (!['admin', 'cobranca', 'juridico', 'diretoria'].includes(perfil)) {
    return res.status(400).json({ erro: 'Perfil inválido.' });
  }
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await db.query(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, perfil, ativo',
      [nome, email, senhaHash, perfil]
    );
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'criar_usuario', entidade: 'usuarios', entidadeId: rows[0].id });
    return res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um usuário com este email.' });
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, perfil, ativo, novaSenha } = req.body;

  try {
    if (nome || perfil || ativo !== undefined) {
      await db.query(
        `UPDATE usuarios SET nome = COALESCE($1, nome), perfil = COALESCE($2, perfil), ativo = COALESCE($3, ativo) WHERE id = $4`,
        [nome || null, perfil || null, ativo === undefined ? null : ativo, id]
      );
    }
    if (novaSenha) {
      const hash = await bcrypt.hash(novaSenha, 10);
      await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, id]);
    }
    const { rows } = await db.query('SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1', [id]);
    await auditoria.registrar({ usuarioId: req.usuario.id, acao: 'editar_usuario', entidade: 'usuarios', entidadeId: id });
    return res.json({ usuario: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
}

module.exports = { listar, criar, atualizar };
