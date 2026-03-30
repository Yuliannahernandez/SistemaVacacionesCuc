const express = require("express");
const router = express.Router();
const {
  registrarSolicitud,
  misSolicitudes,
  consultarSolicitud,
  modificarSolicitud,
  cancelarSolicitud,
  historialSolicitudesDepartamento,
} = require("./controllers/solicitudes.controller");


router.get("/mis-solicitudes", misSolicitudes);


router.get("/consultar", consultarSolicitud);


router.get("/historial", historialSolicitudesDepartamento);


router.post("/registrar", registrarSolicitud);


router.put("/modificar/:id", modificarSolicitud);


router.put("/cancelar/:id", cancelarSolicitud);

module.exports = router;