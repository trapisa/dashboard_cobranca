const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auditoria = require('../services/auditoriaService');

async function login(req, res) {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe email e senha.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1 AND ativo = true', [email]);
    const usuario = rows[0];
    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const payload = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    await auditoria.registrar({ usuarioId: usuario.id, acao: 'login', entidade: 'usuarios', entidadeId: usuario.id });

    return res.json({ token, usuario: payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao autenticar.' });
  }
}

async function me(req, res) {
  return res.json({ usuario: req.usuario });
}

module.exports = { login, me };
