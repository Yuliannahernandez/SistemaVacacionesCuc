// src/routes/modificacion.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const modificacionController = require('./controllers/modificar-funcionario.controller');

router.get('/funcionarios/:cedula', modificacionController.buscarFuncionario);
router.put('/funcionarios/:id',     modificacionController.modificarFuncionario);

module.exports = router;