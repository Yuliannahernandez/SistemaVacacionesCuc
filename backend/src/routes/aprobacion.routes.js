const express = require("express");
const router = express.Router();
const {
  listarPendientes,
  todasLasSolicitudes,
  verSolicitud,
  aprobarSolicitud,
  rechazarSolicitud
} = require("./controllers/aprobacion.controller");

// GET  /api/aprobacion/pendientes?id_departamento=X
router.get("/pendientes", listarPendientes);

// GET  /api/aprobacion/todas?id_departamento=X&estado=aprobada
router.get("/todas", todasLasSolicitudes);

// GET /api/aprobacion/pendientes?id_departamento=X
router.get("/:id", verSolicitud);

// PUT  /api/aprobacion/aprobar/:id  
router.put("/aprobar/:id", aprobarSolicitud);

// PUT  /api/aprobacion/rechazar/:id  
router.put("/rechazar/:id", rechazarSolicitud);

module.exports = router;