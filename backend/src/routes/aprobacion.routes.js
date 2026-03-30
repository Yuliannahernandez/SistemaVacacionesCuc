const express = require("express");
const router = express.Router();
const {
  listarPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
  todasLasSolicitudes,
} = require("./controllers/aprobacion.controller");

// GET  /api/aprobacion/pendientes?id_departamento=X
router.get("/pendientes", listarPendientes);

// GET  /api/aprobacion/todas?id_departamento=X&estado=aprobada
router.get("/todas", todasLasSolicitudes);

// PUT  /api/aprobacion/aprobar/:id   body: { comentario }
router.put("/aprobar/:id", aprobarSolicitud);

// PUT  /api/aprobacion/rechazar/:id  body: { motivo_rechazo }
router.put("/rechazar/:id", rechazarSolicitud);

module.exports = router;