// src/routes/registro.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const registroController = require('./controllers/registro-funcionario.controller');
const { requireAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { PERMISOS } = require('../security/permissions');

router.use(requireAuth);
router.use(authorize(PERMISOS.REGISTRO_FUNCIONARIOS));

router.get('/funcionarios/lista', registroController.listarFuncionarios);
router.post('/funcionarios', registroController.registrarFuncionario);

module.exports = router;
