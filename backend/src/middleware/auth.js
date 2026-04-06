// backend/src/middleware/auth.js
'use strict';

const { verifyToken } = require('../security/jwt');
const db = require('../routes/controllers/db');

function getBearerToken(req) {
  const auth = req.headers?.authorization;
  if (auth && /^Bearer\\s+/i.test(auth)) return auth.replace(/^Bearer\\s+/i, '').trim();

  const headerToken = req.headers?.['x-access-token'];
  if (headerToken) return String(headerToken).trim();

  const bodyToken = req.body?.token || req.body?.jwt || req.body?.accessToken;
  if (bodyToken) return String(bodyToken).trim();

  return null;
}

async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Acceso denegado. Sesión expirada o inválida. Por favor inicie sesión nuevamente.',
      codigo: 'MSG-TU-ERR-001',
    });
  }

  try {
    const payload = verifyToken(token);

    // Verificar usuario activo y rol actual en base de datos (Control de Accesos)
    const id = parseInt(payload.sub, 10);
    const [rows] = await db.query(
      `SELECT id_funcionario, usuario, rol, estado
       FROM funcionarios
       WHERE id_funcionario = ? LIMIT 1`,
      [id]
    );
    const u = rows?.[0];
    if (!u || String(u.estado).toLowerCase() !== 'activo') {
      return res.status(401).json({
        error: 'Acceso denegado. Sesión expirada o inválida. Por favor inicie sesión nuevamente.',
        codigo: 'MSG-TU-ERR-001',
      });
    }

    req.auth = {
      token,
      id_funcionario: u.id_funcionario,
      usuario: u.usuario,
      rol: u.rol,
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      error: 'Acceso denegado. Sesión expirada o inválida. Por favor inicie sesión nuevamente.',
      codigo: 'MSG-TU-ERR-001',
      detalle: err.code || 'TOKEN_ERROR',
    });
  }
}

module.exports = { requireAuth };
