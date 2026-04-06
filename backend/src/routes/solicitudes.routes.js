// src/routes/solicitudes.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const solicitudes = require('./controllers/solicitudes.controller');
const modificarController = require('./controllers/modificar.controller');

router.post('/',   solicitudes.registrar);
router.get('/',    solicitudes.consultar);


router.get('/:id', modificarController.obtener);
router.put('/:id', modificarController.modificar);
module.exports = router;