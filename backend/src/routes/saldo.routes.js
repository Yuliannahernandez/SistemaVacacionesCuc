// src/routes/saldo.routes.js
'use strict';

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { PERMISOS } = require('../security/permissions');
const {
  obtenerSaldoPropio,
  historialPorDepartamento,
  listarColectivas,
  crearColectiva,
  actualizarColectiva,
  eliminarColectiva,
  desactivarColectiva,
  simularLiquidacion,
  getAcumulacion,
  getCalculoSaldo,
  getDescuentos,
  getColectivas,
  getHistorialDepartamento,
  getSaldoDisponible,
  getSimulacionLiquidacion,
} = require('./controllers/saldo.controller');

router.use(requireAuth);
router.use(authorize(PERMISOS.SALDO));

// ── Saldo propio (legacy) ─────────────────────────────────────────────────────
router.get('/mio', obtenerSaldoPropio);

// ── Saldo disponible detallado ────────────────────────────────────────────────
router.get('/disponible/:id_funcionario', getSaldoDisponible);

// ── Cálculo por nombramiento (saldo.html y registrar.html) ───────────────────
router.get('/calculo/:id_funcionario', getCalculoSaldo);

// ── Acumulación histórica ─────────────────────────────────────────────────────
router.get('/acumulacion/:id_funcionario', getAcumulacion);

// ── Descuentos por disfrute ───────────────────────────────────────────────────
router.get('/descuentos/:id_funcionario', getDescuentos);

// ── Historial por departamento ────────────────────────────────────────────────
router.get('/historial-departamento', getHistorialDepartamento);
router.get('/departamento', historialPorDepartamento);

// ── Vacaciones colectivas ─────────────────────────────────────────────────────
router.get('/colectivas',        getColectivas);
router.post('/colectivas',       crearColectiva);
router.put('/colectivas/:id',    actualizarColectiva);
router.delete('/colectivas/:id', eliminarColectiva);
router.delete('/colectivas/:id/desactivar', desactivarColectiva);

// ── Simulación de liquidación ─────────────────────────────────────────────────
router.get('/simulacion/:id_funcionario', getSimulacionLiquidacion);
router.get('/liquidacion', simularLiquidacion);

module.exports = router;
