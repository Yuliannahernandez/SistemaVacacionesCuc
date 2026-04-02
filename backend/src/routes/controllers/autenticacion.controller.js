// src/routes/controllers/autenticacion.controller.js
'use strict';

const db = require('./db');
const crypto = require('crypto');

const MAX_INTENTOS = 3; // V4: bloquear al superar 3 intentos fallidos

// ─── Helper: registrar en auditoria_login ─────────────────────────────────────
async function registrarAuditoria({ usuario, id_funcionario = null, resultado, motivo_fallo = null, intentos = 0, sesion_id = null, ip, userAgent }) {
    try {
        await db.query(
            `INSERT INTO auditoria_login
                (usuario, id_funcionario, tipo_autenticacion, resultado, motivo_fallo,
                 intentos_fallidos_consecutivos, sesion_id, ip_address, user_agent)
             VALUES (?, ?, 'local', ?, ?, ?, ?, ?, ?)`,
            [usuario, id_funcionario, resultado, motivo_fallo, intentos, sesion_id, ip, userAgent]
        );
    } catch { /* el fallo de auditoría nunca bloquea la respuesta */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login  —  RQ-SVC-2026-08 Seguridad
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
    const { usuario, contrasena } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.socket?.remoteAddress || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || null;

    // ── V6: Campos vacíos ─────────────────────────────────────────────────────
    if (!usuario?.trim() || !contrasena?.trim()) {
        return res.status(400).json({
            error: 'Los campos usuario y contraseña son obligatorios.',
            codigo: 'MSG-SEG-ERR-005'
        });
    }

    const usuarioLimpio = usuario.trim();

    try {
        // ── V1: El usuario debe existir ───────────────────────────────────────
        const [rows] = await db.query(
            `SELECT
                f.id_funcionario, f.cedula,
                f.nombre, f.apellido1, f.apellido2,
                f.email, f.telefono,
                f.rol, f.usuario, f.contrasena,
                f.estado, f.estado_contrato,
                f.intentos_fallidos,
                f.id_departamento, f.id_cargo,
                f.id_tipo_nombramiento, f.id_supervisor,
                f.dias_vacaciones_acumulados, f.dias_vacaciones_disponibles,
                f.en_periodo_prueba, f.fecha_ingreso,
                f.fecha_nombramiento, f.fecha_fin_nombramiento,
                f.numero_nombramiento, f.id_periodo_lectivo_activo,
                d.nombre_departamento,
                c.nombre_cargo
             FROM funcionarios f
             LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
             LEFT JOIN cargos       c ON f.id_cargo         = c.id_cargo
             WHERE f.usuario = ? OR f.email = ?`,
            [usuarioLimpio, usuarioLimpio]
        );

        if (rows.length === 0) {
            await registrarAuditoria({ usuario: usuarioLimpio, resultado: 'fallido', motivo_fallo: 'Usuario no encontrado', ip, userAgent });
            return res.status(401).json({
                error: 'Usuario no encontrado. Verifique los datos ingresados.',
                codigo: 'MSG-SEG-ERR-004'
            });
        }

        const funcionario = rows[0];

        // ── V2: El usuario debe estar activo (no inactivo, suspendido ni bloqueado) ──
        if (funcionario.estado !== 'activo') {
            await registrarAuditoria({
                usuario: usuarioLimpio, id_funcionario: funcionario.id_funcionario,
                resultado: 'bloqueado', motivo_fallo: `Estado: ${funcionario.estado}`,
                intentos: funcionario.intentos_fallidos, ip, userAgent
            });
            return res.status(403).json({
                error: 'El usuario se encuentra inactivo o bloqueado. Contacte al administrador del sistema.',
                codigo: 'MSG-SEG-ERR-002'
            });
        }

        // ── V3: La contraseña debe coincidir ──────────────────────────────────
        if (funcionario.contrasena !== contrasena) {
            const nuevosIntentos = (funcionario.intentos_fallidos || 0) + 1;

            // ── V4: Bloquear si supera MAX_INTENTOS ───────────────────────────
            if (nuevosIntentos >= MAX_INTENTOS) {
                await db.query(
                    `UPDATE funcionarios SET estado = 'bloqueado', intentos_fallidos = ? WHERE id_funcionario = ?`,
                    [nuevosIntentos, funcionario.id_funcionario]
                );
                await registrarAuditoria({
                    usuario: usuarioLimpio, id_funcionario: funcionario.id_funcionario,
                    resultado: 'bloqueado', motivo_fallo: `Cuenta bloqueada tras ${nuevosIntentos} intentos`,
                    intentos: nuevosIntentos, ip, userAgent
                });
                return res.status(403).json({
                    error: 'Su cuenta ha sido bloqueada por múltiples intentos fallidos. Contacte al administrador del sistema.',
                    codigo: 'MSG-SEG-ERR-001'
                });
            }

            // Incrementar contador sin bloquear aún
            await db.query(
                `UPDATE funcionarios SET intentos_fallidos = ? WHERE id_funcionario = ?`,
                [nuevosIntentos, funcionario.id_funcionario]
            );
            await registrarAuditoria({
                usuario: usuarioLimpio, id_funcionario: funcionario.id_funcionario,
                resultado: 'fallido', motivo_fallo: 'Contraseña incorrecta',
                intentos: nuevosIntentos, ip, userAgent
            });
            return res.status(401).json({
                error: 'Credenciales incorrectas. Verifique su usuario y contraseña.',
                codigo: 'MSG-SEG-ERR-003',
                intentosRestantes: MAX_INTENTOS - nuevosIntentos
            });
        }

        // ── Login exitoso ─────────────────────────────────────────────────────

        // Resetear contador de intentos
        await db.query(
            `UPDATE funcionarios SET intentos_fallidos = 0 WHERE id_funcionario = ?`,
            [funcionario.id_funcionario]
        );

        // Generar token de sesión (V5: expira a los 10 min de inactividad — controlado en frontend)
        const sessionToken = crypto.randomUUID();
        const sessionExpiry = Date.now() + (10 * 60 * 1000);

        // Registrar inicio de sesión exitoso (Paso 7 del RQ)
        await registrarAuditoria({
            usuario: usuarioLimpio, id_funcionario: funcionario.id_funcionario,
            resultado: 'exitoso', intentos: 0,
            sesion_id: sessionToken, ip, userAgent
        });

        // Tipo de nombramiento vigente
        let tipoNombramiento = null;
        if (funcionario.id_tipo_nombramiento) {
            const [tn] = await db.query(
                `SELECT id_tipo_nombramiento, nombre_tipo, descripcion,
                        es_docente_interino, dias_vacaciones_anuales,
                        dias_acumulacion_mensual_tramo1, dias_acumulacion_mensual_tramo2,
                        semanas_antiguedad_minima
                 FROM tipos_nombramiento WHERE id_tipo_nombramiento = ?`,
                [funcionario.id_tipo_nombramiento]
            );
            tipoNombramiento = tn[0] || null;
        }

        // Cambio Yuliana
        // Nombramientos activos del funcionario
        const [nombramientos] = await db.query(
            `SELECT fn.id_nombramiento, fn.numero_nombramiento,
            fn.fecha_nombramiento, fn.fecha_fin_nombramiento,
            fn.en_periodo_prueba, fn.es_activo,
            tn.id_tipo_nombramiento, tn.nombre_tipo,
            tn.es_docente_interino, tn.dias_vacaciones_anuales,
            tn.dias_acumulacion_mensual_tramo1,
            tn.dias_acumulacion_mensual_tramo2
     FROM funcionarios_nombramientos fn
     JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
     WHERE fn.id_funcionario = ? AND fn.es_activo = 1
     ORDER BY fn.fecha_nombramiento DESC`,
            [funcionario.id_funcionario]
        );

        // No enviar contraseña ni contador en la respuesta
        const { contrasena: _p, intentos_fallidos: _i, ...funcionarioPublico } = funcionario;

        return res.json({
            mensaje: 'Acceso autorizado. Bienvenido al SVC.',
            codigo: 'MSG-SEG-001',
            sessionToken,
            sessionExpiry,
            funcionario: funcionarioPublico,
            tipoNombramiento,
            nombramientos
        });

    } catch (err) {
        console.error('[autenticacion.controller] login error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Registra cierre manual o por inactividad en auditoría (Paso 7 del RQ)
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
    const { id_funcionario, usuario, sessionToken, motivo = 'manual' } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.socket?.remoteAddress || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || null;

    try {
        if (sessionToken) {
            await db.query(
                `UPDATE auditoria_login
                 SET fecha_cierre_sesion = NOW(),
                     duracion_sesion = TIMESTAMPDIFF(MINUTE, fecha_hora, NOW())
                 WHERE sesion_id = ? AND resultado = 'exitoso'
                 ORDER BY fecha_hora DESC LIMIT 1`,
                [sessionToken]
            );
        }

        // Registrar evento de cierre por inactividad
        if (motivo === 'inactividad') {
            await registrarAuditoria({
                usuario: usuario || 'desconocido',
                id_funcionario: id_funcionario || null,
                resultado: 'fallido',
                motivo_fallo: 'Sesión cerrada por inactividad (V5)',
                sesion_id: sessionToken,
                ip, userAgent
            });
        }

        return res.json({ mensaje: 'Sesión cerrada correctamente.' });
    } catch (err) {
        console.error('[autenticacion.controller] logout error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};