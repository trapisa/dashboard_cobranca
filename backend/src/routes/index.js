const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');

const { autenticar, permitir } = require('../middleware/auth');
const authController = require('../controllers/authController');
const importacaoController = require('../controllers/importacaoController');
const dashboardController = require('../controllers/dashboardController');
const clientesController = require('../controllers/clientesController');
const reguaController = require('../controllers/reguaController');
const scoreController = require('../controllers/scoreController');
const juridicoController = require('../controllers/juridicoController');
const usuariosController = require('../controllers/usuariosController');

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 25) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Apenas arquivos .xlsx ou .xls são aceitos.'));
    }
    cb(null, true);
  },
});

// ---------- Auth ----------
router.post('/auth/login', authController.login);
router.get('/auth/me', autenticar, authController.me);

// ---------- Importação (Admin) ----------
router.post('/importacoes/upload', autenticar, permitir('admin'), upload.single('arquivo'), importacaoController.upload);
router.get('/importacoes', autenticar, permitir('admin', 'diretoria'), importacaoController.listar);
router.get('/importacoes/:id', autenticar, permitir('admin', 'diretoria'), importacaoController.detalhe);

// ---------- Dashboard (todos os perfis autenticados) ----------
router.get('/dashboard/resumo', autenticar, dashboardController.resumo);

// ---------- Clientes / Ficha ----------
router.get('/clientes', autenticar, clientesController.listar);
router.get('/clientes/:id', autenticar, clientesController.ficha);
router.post('/clientes/:id/recalcular-score', autenticar, permitir('admin', 'cobranca'), clientesController.recalcularScore);
router.post('/clientes/:id/eventos', autenticar, permitir('admin', 'cobranca', 'juridico'), clientesController.registrarEvento);
router.post('/clientes/:id/encaminhar-juridico', autenticar, permitir('admin', 'cobranca'), clientesController.encaminharJuridico);
router.get('/clientes/:id/regua', autenticar, reguaController.etapaAtualCliente);

// ---------- Régua de cobrança (Admin configura) ----------
router.get('/regua/etapas', autenticar, reguaController.listarEtapas);
router.post('/regua/etapas', autenticar, permitir('admin'), reguaController.criarEtapa);
router.put('/regua/etapas/:id', autenticar, permitir('admin'), reguaController.atualizarEtapa);
router.delete('/regua/etapas/:id', autenticar, permitir('admin'), reguaController.removerEtapa);

router.get('/regua/templates', autenticar, reguaController.listarTemplates);
router.post('/regua/templates', autenticar, permitir('admin'), reguaController.criarTemplate);
router.put('/regua/templates/:id', autenticar, permitir('admin'), reguaController.atualizarTemplate);

// ---------- Score (Admin configura regras) ----------
router.get('/score/regras', autenticar, scoreController.listarRegras);
router.post('/score/regras', autenticar, permitir('admin'), scoreController.criarRegra);
router.put('/score/regras/:id', autenticar, permitir('admin'), scoreController.atualizarRegra);
router.delete('/score/regras/:id', autenticar, permitir('admin'), scoreController.removerRegra);

// ---------- Jurídico ----------
router.get('/juridico/casos', autenticar, permitir('admin', 'juridico', 'diretoria'), juridicoController.listarCasos);
router.get('/juridico/casos/:id', autenticar, permitir('admin', 'juridico', 'diretoria'), juridicoController.detalheCaso);
router.put('/juridico/casos/:id', autenticar, permitir('admin', 'juridico'), juridicoController.atualizarCaso);

// ---------- Usuários (Admin) ----------
router.get('/usuarios', autenticar, permitir('admin'), usuariosController.listar);
router.post('/usuarios', autenticar, permitir('admin'), usuariosController.criar);
router.put('/usuarios/:id', autenticar, permitir('admin'), usuariosController.atualizar);

module.exports = router;
