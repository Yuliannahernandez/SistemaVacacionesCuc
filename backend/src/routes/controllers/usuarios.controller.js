// backend/src/routes/controllers/usuarios.controller.js
'use strict';

const crypto = require('crypto');
const db = require('./db');

const TIPOS_USUARIO_CATALOGO = [
  { value: 'funcionario', label: 'Empleado' },
  { value: 'jefe', label: 'Jefe' },
  { value: 'rrhh', label: 'RRHH' },
  { value: 'admin', label: 'Administrador' },
];

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function isTipoValido(tipo) {
  return TIPOS_USUARIO_CATALOGO.some(t => t.value === String(tipo || '').toLowerCase());
}

exports.listarTiposUsuario = async (req, res) => {
  return res.json({ tipos: TIPOS_USUARIO_CATALOGO });
};

exports.listarUsuarios = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const search = String(req.query.search || '').trim();

  const where = [];
  const params = [];
  if (search) {
    where.push(`(
      f.nombre LIKE ? OR f.apellido1 LIKE ? OR f.apellido2 LIKE ?
      OR f.cedula LIKE ? OR f.usuario LIKE ? OR f.email LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM funcionarios f ${whereSql}`,
      params
    );
    const total = countRows?.[0]?.total || 0;

    const [rows] = await db.query(
      `SELECT f.id_funcionario, f.cedula AS codigo,
              f.nombre, f.apellido1, f.apellido2,
              f.estado, f.rol,
              d.nombre_departamento AS area
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       ${whereSql}
       ORDER BY f.apellido1, f.nombre
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json({ page, pageSize, total, usuarios: rows, codigo: 'MSG-TU-INFO-001' });
  } catch (err) {
    console.error('[usuarios.controller] listarUsuarios error:', err.message);
    return res.status(500).json({
      error: 'Error al cargar los datos. Por favor intente de nuevo. Si el problema persiste, contacte al soporte técnico.',
      codigo: 'MSG-TU-ERR-007',
    });
  }
};

exports.asignarTipoUsuario = async (req, res) => {
  const idUsuario = parseInt(req.params.id, 10);
  const tipoUsuario = String(req.body?.tipoUsuario || req.body?.tipo || '').trim().toLowerCase();

  if (!tipoUsuario) {
    return res.status(400).json({
      error: 'Debe seleccionar un tipo de usuario antes de guardar. El campo no puede quedar vacío.',
      codigo: 'MSG-TU-ERR-006',
    });
  }
  if (!isTipoValido(tipoUsuario)) {
    return res.status(400).json({
      error: 'El tipo de usuario seleccionado no es válido. Seleccione una opción del catálogo disponible.',
      codigo: 'MSG-TU-ERR-004',
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT id_funcionario, rol, estado FROM funcionarios WHERE id_funcionario = ? LIMIT 1`,
      [idUsuario]
    );
    const target = rows?.[0];
    if (!target || String(target.estado).toLowerCase() !== 'activo') {
      return res.status(404).json({
        error: 'El usuario seleccionado no existe o no está activo. No se puede modificar el tipo de usuario.',
        codigo: 'MSG-TU-ERR-003',
      });
    }

    const tipoAnterior = String(target.rol || '').toLowerCase();
    if (tipoAnterior === tipoUsuario) {
      return res.json({
        mensaje: 'El tipo seleccionado es igual al tipo actual. No se realizaron cambios.',
        codigo: 'MSG-TU-INFO-004',
      });
    }

    const requesterId = parseInt(req.auth?.id_funcionario, 10);
    if (requesterId === idUsuario && tipoUsuario === 'admin' && tipoAnterior !== 'admin') {
      const confirmationId = crypto.randomUUID();
      const expiraEn = new Date(Date.now() + 120 * 1000);
      try {
        await db.query(
          `INSERT INTO tipo_usuario_confirmaciones
            (id_confirmacion, id_usuario_objetivo, tipo_nuevo, id_admin_solicitante, expira_en)
           VALUES (?, ?, ?, ?, ?)`,
          [confirmationId, idUsuario, tipoUsuario, requesterId, expiraEn]
        );
      } catch (err) {
        console.error('[usuarios.controller] confirmación insert error:', err.message);
        return res.status(503).json({
          error:
            'No se pudo completar la operación. El servicio de auditoría no está disponible. Contacte al administrador de infraestructura.',
          codigo: 'MSG-TU-ERR-005',
        });
      }

      return res.status(409).json({
        error:
          'No puede autoasignarse el tipo Administrador. Se requiere confirmación de otro Administrador activo. Tiene 120 segundos para completar la confirmación.',
        codigo: 'MSG-TU-ADV-001',
        confirmationRequired: true,
        confirmationId,
        expiresInSeconds: 120,
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE funcionarios SET rol = ? WHERE id_funcionario = ?`, [tipoUsuario, idUsuario]);
      await conn.query(
        `INSERT INTO auditoria_tipos_usuario
          (id_usuario_modificado, tipo_anterior, tipo_nuevo, id_admin, admin_usuario, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          idUsuario,
          tipoAnterior,
          tipoUsuario,
          requesterId,
          req.auth?.usuario || null,
          getIp(req),
        ]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error('[usuarios.controller] asignarTipoUsuario tx error:', err.message);
      return res.status(503).json({
        error:
          'No se pudo completar la operación. El servicio de auditoría no está disponible. Contacte al administrador de infraestructura.',
        codigo: 'MSG-TU-ERR-005',
      });
    } finally {
      conn.release();
    }

    return res.json({
      mensaje: 'Tipo de usuario asignado correctamente. Los permisos del usuario han sido actualizados.',
      codigo: 'MSG-TU-001',
    });
  } catch (err) {
    console.error('[usuarios.controller] asignarTipoUsuario error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

exports.crearConfirmacionTipoUsuario = async (req, res) => {
  const { id_usuario_objetivo, tipo_nuevo } = req.body || {};
  const idUsuario = parseInt(id_usuario_objetivo, 10);
  const tipo = String(tipo_nuevo || '').trim().toLowerCase();
  if (!idUsuario || !tipo) return res.status(400).json({ error: 'Parámetros inválidos.' });
  if (!isTipoValido(tipo)) {
    return res.status(400).json({
      error: 'El tipo de usuario seleccionado no es válido. Seleccione una opción del catálogo disponible.',
      codigo: 'MSG-TU-ERR-004',
    });
  }

  const confirmationId = crypto.randomUUID();
  const expiraEn = new Date(Date.now() + 120 * 1000);
  try {
    await db.query(
      `INSERT INTO tipo_usuario_confirmaciones
        (id_confirmacion, id_usuario_objetivo, tipo_nuevo, id_admin_solicitante, expira_en)
       VALUES (?, ?, ?, ?, ?)`,
      [confirmationId, idUsuario, tipo, parseInt(req.auth?.id_funcionario, 10), expiraEn]
    );
    return res.json({ confirmationId, expiresInSeconds: 120 });
  } catch (err) {
    console.error('[usuarios.controller] crearConfirmacionTipoUsuario error:', err.message);
    return res.status(503).json({
      error:
        'No se pudo completar la operación. El servicio de auditoría no está disponible. Contacte al administrador de infraestructura.',
      codigo: 'MSG-TU-ERR-005',
    });
  }
};

exports.confirmarTipoUsuario = async (req, res) => {
  const idConfirmacion = String(req.params.id || '').trim();
  try {
    const [rows] = await db.query(
      `SELECT id_confirmacion, id_usuario_objetivo, tipo_nuevo, id_admin_solicitante, expira_en, usado
       FROM tipo_usuario_confirmaciones
       WHERE id_confirmacion = ? LIMIT 1`,
      [idConfirmacion]
    );
    const conf = rows?.[0];
    if (!conf || conf.usado) return res.status(404).json({ error: 'Confirmación no encontrada o ya utilizada.' });
    if (new Date(conf.expira_en).getTime() < Date.now()) return res.status(410).json({ error: 'Confirmación expirada.' });

    const segundoAdminId = parseInt(req.auth?.id_funcionario, 10);
    if (!segundoAdminId || segundoAdminId === parseInt(conf.id_admin_solicitante, 10)) {
      return res.status(403).json({ error: 'Se requiere confirmación de otro Administrador activo.', codigo: 'MSG-TU-ADV-001' });
    }

    const [admins] = await db.query(
      `SELECT id_funcionario, estado, rol FROM funcionarios WHERE id_funcionario = ? LIMIT 1`,
      [segundoAdminId]
    );
    const admin2 = admins?.[0];
    if (!admin2 || String(admin2.estado).toLowerCase() !== 'activo' || String(admin2.rol).toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Se requiere confirmación de otro Administrador activo.', codigo: 'MSG-TU-ADV-001' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [targetRows] = await conn.query(
        `SELECT id_funcionario, rol, estado FROM funcionarios WHERE id_funcionario = ? LIMIT 1 FOR UPDATE`,
        [conf.id_usuario_objetivo]
      );
      const target = targetRows?.[0];
      if (!target || String(target.estado).toLowerCase() !== 'activo') {
        await conn.rollback();
        return res.status(404).json({
          error: 'El usuario seleccionado no existe o no está activo. No se puede modificar el tipo de usuario.',
          codigo: 'MSG-TU-ERR-003',
        });
      }

      const tipoAnterior = String(target.rol || '').toLowerCase();
      await conn.query(`UPDATE funcionarios SET rol = ? WHERE id_funcionario = ?`, [conf.tipo_nuevo, conf.id_usuario_objetivo]);

      await conn.query(
        `INSERT INTO auditoria_tipos_usuario
          (id_usuario_modificado, tipo_anterior, tipo_nuevo, id_admin, admin_usuario, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          conf.id_usuario_objetivo,
          tipoAnterior,
          conf.tipo_nuevo,
          parseInt(conf.id_admin_solicitante, 10),
          req.auth?.usuario || null,
          getIp(req),
        ]
      );

      await conn.query(
        `UPDATE tipo_usuario_confirmaciones
         SET usado = 1, confirmado_por = ?, confirmado_en = NOW()
         WHERE id_confirmacion = ?`,
        [segundoAdminId, idConfirmacion]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error('[usuarios.controller] confirmarTipoUsuario tx error:', err.message);
      return res.status(503).json({
        error:
          'No se pudo completar la operación. El servicio de auditoría no está disponible. Contacte al administrador de infraestructura.',
        codigo: 'MSG-TU-ERR-005',
      });
    } finally {
      conn.release();
    }

    return res.json({
      mensaje: 'Tipo de usuario asignado correctamente. Los permisos del usuario han sido actualizados.',
      codigo: 'MSG-TU-001',
    });
  } catch (err) {
    console.error('[usuarios.controller] confirmarTipoUsuario error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

exports.actualizarDatosAutenticacion = async (req, res) => {
  const idUsuario = parseInt(req.params.id, 10);
  const usuario = String(req.body?.usuario || '').trim();
  const email = String(req.body?.email || '').trim();
  const contrasena = req.body?.contrasena != null ? String(req.body.contrasena) : null;
  const estado = String(req.body?.estado || '').trim().toLowerCase();
  const rol = String(req.body?.rol || '').trim().toLowerCase();

  if (!usuario) return res.status(400).json({ error: 'El usuario no puede estar vacío.', codigo: 'MSG-DAT-ERR-001' });
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Formato de correo inválido.', codigo: 'MSG-DAT-ERR-002' });
  }
  if (contrasena != null && String(contrasena).trim().length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres.', codigo: 'MSG-DAT-ERR-003' });
  }
  if (!['activo', 'inactivo'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido. Debe ser Activo o Inactivo.', codigo: 'MSG-DAT-ERR-004' });
  }
  if (rol && !isTipoValido(rol)) {
    return res.status(400).json({
      error: 'El tipo de usuario seleccionado no es válido. Seleccione una opción del catálogo disponible.',
      codigo: 'MSG-TU-ERR-004',
    });
  }

  try {
    const [exists] = await db.query(
      `SELECT id_funcionario
       FROM funcionarios
       WHERE (usuario = ? OR email = ?) AND id_funcionario <> ?
       LIMIT 1`,
      [usuario, email, idUsuario]
    );
    if (exists?.length) {
      return res.status(409).json({ error: 'El usuario o correo ya está en uso.', codigo: 'MSG-DAT-ERR-002' });
    }

    const [currentRows] = await db.query(`SELECT id_funcionario FROM funcionarios WHERE id_funcionario = ? LIMIT 1`, [idUsuario]);
    if (!currentRows?.length) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const sets = ['usuario = ?', 'email = ?', 'estado = ?'];
    const params = [usuario, email, estado];
    if (rol) {
      sets.push('rol = ?');
      params.push(rol);
    }
    if (contrasena != null) {
      sets.push('contrasena = ?');
      params.push(String(contrasena));
    }
    params.push(idUsuario);

    await db.query(`UPDATE funcionarios SET ${sets.join(', ')} WHERE id_funcionario = ?`, params);

    return res.json({ mensaje: 'Datos de autenticación guardados correctamente.', codigo: 'MSG-DAT-001' });
  } catch (err) {
    console.error('[usuarios.controller] actualizarDatosAutenticacion error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

