// src/routes/solicitudes.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const solicitudes = require('./controllers/solicitudes.controller');

router.post('/',   solicitudes.registrar);
router.get('/',    solicitudes.consultar);

module.exports = router;