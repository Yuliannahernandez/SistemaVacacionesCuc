// src/routes/catalogos.routes.js
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('./controllers/catalogos.controller');

// GET /api/catalogos/departamentos
router.get('/departamentos',       ctrl.getDepartamentos);

// GET /api/catalogos/cargos
router.get('/cargos',              ctrl.getCargos);

// GET /api/catalogos/tipos-nombramiento
router.get('/tipos-nombramiento',  ctrl.getTiposNombramiento);


// GET /api/catalogos/periodos-lectivos
router.get('/periodos-lectivos',  ctrl.getPeriodosLectivos);

module.exports = router;