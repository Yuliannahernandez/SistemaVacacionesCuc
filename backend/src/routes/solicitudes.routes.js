// src/routes/solicitudes.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const solicitudes = require('./controllers/solicitudes.controller');
const modificarController = require('./controllers/modificar.controller');
const cancelar = require('./controllers/cancelar.controller');
router.get('/cancelables', cancelar.listarCancelables);
router.delete('/:id_solicitud', cancelar.cancelar);

router.post('/',   solicitudes.registrar);
router.get('/',    solicitudes.consultar);


router.get('/:id', modificarController.obtener);
router.put('/:id', modificarController.modificar);
module.exports = router;