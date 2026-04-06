// backend/src/middleware/authorize.js
'use strict';

const { isValidRole, hasPermission } = require('../security/permissions');

function authorize(permission) {
  return (req, res, next) => {
    const rol = req.auth?.rol;

    // V1 (Control de Accesos): El rol debe existir
    if (!isValidRole(rol)) {
      return res.status(403).json({
        error: 'Rol no válido.',
        codigo: 'MSG-ACC-ERR-001',
      });
    }

    // V2 (Control de Accesos): El rol debe tener permiso
    if (!hasPermission(rol, permission)) {
      return res.status(403).json({
        error: 'Acceso denegado: no tiene permisos.',
        codigo: 'MSG-ACC-ERR-002',
      });
    }

    return next();
  };
}

module.exports = { authorize };

