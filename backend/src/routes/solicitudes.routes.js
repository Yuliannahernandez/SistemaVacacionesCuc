// src/routes/solicitudes.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const solicitudes = require('./controllers/solicitudes.controller');
const { requireAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { PERMISOS } = require('../security/permissions');

router.use(requireAuth);
router.use(authorize(PERMISOS.SOLICITUDES));

router.post('/',   solicitudes.registrar);
router.get('/',    solicitudes.consultar);

module.exports = router;
