// src/routes/registro-funcionario.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const registroController = require('./controllers/registro-funcionario.controller');

// ── Catálogos ──────────────────────────────────────────────────────────────
router.get('/departamentos', registroController.listarDepartamentos);
router.get('/cargos', registroController.listarCargos);
router.get('/tipos-nombramiento', registroController.listarTiposNombramiento);
router.get('/periodos-lectivos', registroController.listarPeriodosLectivos);

// ── Funcionarios ───────────────────────────────────────────────────────────
// IMPORTANTE: /lista debe ir ANTES de /:id
router.get('/funcionarios/lista', registroController.listarFuncionarios);
router.post('/funcionarios', registroController.registrarFuncionario);
router.get('/funcionarios/:id', registroController.obtenerFuncionario);
router.put('/funcionarios/:id', registroController.actualizarFuncionario);

module.exports = router;