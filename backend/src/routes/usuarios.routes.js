// backend/src/routes/usuarios.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { PERMISOS } = require('../security/permissions');
const usuarios = require('./controllers/usuarios.controller');

router.use(requireAuth);

router.get('/', authorize(PERMISOS.GESTION_USUARIOS), usuarios.listarUsuarios);
router.get('/tipos', authorize(PERMISOS.GESTION_USUARIOS), usuarios.listarTiposUsuario);
router.put('/:id/tipo', authorize(PERMISOS.GESTION_USUARIOS), usuarios.asignarTipoUsuario);
router.post('/confirmaciones', authorize(PERMISOS.GESTION_USUARIOS), usuarios.crearConfirmacionTipoUsuario);
router.post('/confirmaciones/:id/confirmar', authorize(PERMISOS.GESTION_USUARIOS), usuarios.confirmarTipoUsuario);
router.put('/:id/autenticacion', authorize(PERMISOS.GESTION_USUARIOS), usuarios.actualizarDatosAutenticacion);

module.exports = router;

