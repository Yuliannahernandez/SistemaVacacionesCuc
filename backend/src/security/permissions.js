// backend/src/security/permissions.js
'use strict';

const ROLES_VALIDOS = ['funcionario', 'jefe', 'rrhh', 'admin'];

const PERMISOS = {
  SOLICITUDES: 'SOLICITUDES',
  SALDO: 'SALDO',
  APROBACION: 'APROBACION',
  REGISTRO_FUNCIONARIOS: 'REGISTRO_FUNCIONARIOS',
  CATALOGOS: 'CATALOGOS',
  GESTION_USUARIOS: 'GESTION_USUARIOS',
};

const ROLE_PERMISSIONS = {
  funcionario: new Set([PERMISOS.SOLICITUDES, PERMISOS.SALDO, PERMISOS.CATALOGOS]),
  jefe: new Set([PERMISOS.SOLICITUDES, PERMISOS.SALDO, PERMISOS.CATALOGOS, PERMISOS.APROBACION]),
  rrhh: new Set([
    PERMISOS.SOLICITUDES,
    PERMISOS.SALDO,
    PERMISOS.CATALOGOS,
    PERMISOS.APROBACION,
    PERMISOS.REGISTRO_FUNCIONARIOS,
  ]),
  admin: new Set(Object.values(PERMISOS)),
};

function isValidRole(role) {
  return ROLES_VALIDOS.includes(String(role || '').toLowerCase());
}

function hasPermission(role, permission) {
  const r = String(role || '').toLowerCase();
  return ROLE_PERMISSIONS[r]?.has(permission) || false;
}

module.exports = { ROLES_VALIDOS, PERMISOS, isValidRole, hasPermission };

