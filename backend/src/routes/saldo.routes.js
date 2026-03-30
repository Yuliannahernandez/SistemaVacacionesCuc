const express = require("express");
const router = express.Router();
const {
  obtenerSaldoPropio,
  historialPorDepartamento,
  listarColectivas,
  crearColectiva,
  desactivarColectiva,
  simularLiquidacion,
} = require('./controllers/saldo.controller');
// ── Saldo propio del funcionario ──────────────────────────────────────────────
// GET /api/saldo/mio?id_funcionario=X
router.get("/mio", obtenerSaldoPropio);

// ── Historial por departamento (Jefe / RRHH) ──────────────────────────────────
// GET /api/saldo/departamento?id_departamento=X
router.get("/departamento", historialPorDepartamento);

// ── Vacaciones colectivas ─────────────────────────────────────────────────────
// GET  /api/saldo/colectivas
router.get("/colectivas", listarColectivas);
// POST /api/saldo/colectivas   body: { descripcion, fecha_inicio, fecha_fin }
router.post("/colectivas", crearColectiva);
// DELETE /api/saldo/colectivas/:id
router.delete("/colectivas/:id", desactivarColectiva);

// ── Simulación de liquidación ─────────────────────────────────────────────────
// GET /api/saldo/liquidacion?id_funcionario=X
router.get("/liquidacion", simularLiquidacion);

module.exports = router;