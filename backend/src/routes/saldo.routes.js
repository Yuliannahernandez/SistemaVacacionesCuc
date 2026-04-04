const express = require("express");
const router = express.Router();
const {
  obtenerSaldoPropio,
  historialPorDepartamento,
  listarColectivas,
  crearColectiva,
  desactivarColectiva,
  simularLiquidacion,
  
  acumularVacaciones,
  calcularSaldoVacaciones,
  registrarDescuentoVacaciones,
} = require('./controllers/saldo.controller');



router.get("/mio", obtenerSaldoPropio);


router.get("/departamento", historialPorDepartamento);

// ── Vacaciones colectivas ─────────────────────────────────────────────────────
// GET  /api/saldo/colectivas
router.get("/colectivas", listarColectivas);
// POST /api/saldo/colectivas   body: { descripcion, fecha_inicio, fecha_fin }
router.post("/colectivas", crearColectiva);
// DELETE /api/saldo/colectivas/:id
router.delete("/colectivas/:id", desactivarColectiva);


router.get("/liquidacion", simularLiquidacion);


router.post("/acumulacion", acumularVacaciones);

// ── RQ-02 · Cálculo de Saldo de Vacaciones ───────────────────────────────────

router.get("/calculo", calcularSaldoVacaciones);

// ── RQ-03 · Descuento por Disfrute de Vacaciones ─────────────────────────────

router.patch("/descuento/:id_solicitud", registrarDescuentoVacaciones);

module.exports = router;