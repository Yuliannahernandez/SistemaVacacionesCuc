// src/routes/registro.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const registroController = require('./controllers/registro-funcionario.controller');

router.get('/funcionarios/lista', registroController.listarFuncionarios);
router.post('/funcionarios', registroController.registrarFuncionario);

module.exports = router;