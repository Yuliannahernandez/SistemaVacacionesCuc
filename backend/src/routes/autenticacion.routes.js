// src/routes/autenticacion.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const autenticacionController = require('./controllers/autenticacion.controller');

router.post('/login', autenticacionController.login);
router.post('/logout', autenticacionController.logout);

module.exports = router;