// src/routes/controllers/cancelar.controller.js
'use strict';

const db = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/solicitudes/cancelables?id_funcionario=X
// Devuelve solicitudes en estado 'pendiente' o 'aprobada' cuya fecha_inicio
// sea igual o posterior a hoy (no se pueden cancelar con efecto retroactivo).
// ─────────────────────────────────────────────────────────────────────────────
exports.listarCancelables = async (req, res) => {
    const { id_funcionario } = req.query;

    if (!id_funcionario) {
        return res.status(400).json({
            error: 'Se requiere id_funcionario.',
            codigo: 'MSG-ERR-040'
        });
    }

    try {
        const hoy = new Date().toISOString().slice(0, 10);

        const [rows] = await db.query(
            `SELECT
                sv.id_solicitud,
                sv.numero_solicitud,
                sv.fecha_inicio,
                sv.fecha_fin,
                sv.dias_solicitados,
                sv.estado,
                sv.motivo,
                sv.modalidad,
                sv.saldo_antes,
                sv.saldo_despues,
                sv.fecha_creacion,
                sv.fecha_aprobacion,
                sv.comentarios_aprobador,
                sv.id_nombramiento,
                fn.numero_nombramiento,
                tn.nombre_tipo,
                tn.es_docente_interino,
                fn.dias_vacaciones_disponibles AS saldo_actual,
                fn.id_periodo_lectivo,
                -- Aprobador del historial más reciente con estado 'aprobada'
                (SELECT hs2.id_usuario
                 FROM historial_solicitudes hs2
                 WHERE hs2.id_solicitud = sv.id_solicitud
                   AND hs2.estado_nuevo = 'aprobada'
                 ORDER BY hs2.fecha_accion DESC
                 LIMIT 1) AS id_aprobador
             FROM solicitudes_vacaciones sv
             JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
             JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
             WHERE sv.id_funcionario = ?
               AND sv.estado IN ('pendiente', 'aprobada')
               AND sv.fecha_inicio >= ?
             ORDER BY sv.fecha_inicio ASC`,
            [id_funcionario, hoy]
        );

        // Para cada solicitud, adjuntar historial
        const solicitudes = await Promise.all(rows.map(async (s) => {
            const [hist] = await db.query(
                `SELECT hs.accion, hs.estado_anterior, hs.estado_nuevo,
                        hs.comentario, hs.fecha_accion, hs.id_usuario
                 FROM historial_solicitudes hs
                 WHERE hs.id_solicitud = ?
                 ORDER BY hs.fecha_accion ASC`,
                [s.id_solicitud]
            );
            return { ...s, historial: hist };
        }));

        return res.json({ solicitudes });

    } catch (err) {
        console.error('[cancelar.controller] listarCancelables error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/solicitudes/:id_solicitud
// Body: { id_funcionario, motivo_cancelacion? }
//
// Validaciones:
//   V1 — La solicitud debe existir y pertenecer al funcionario
//   V2 — Estado debe ser 'pendiente' o 'aprobada'
//   V3 — fecha_inicio >= hoy (no cancelación retroactiva)
//   V4 — motivo_cancelacion máximo 500 caracteres (opcional)
//   V5 — El funcionario debe estar activo
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelar = async (req, res) => {
    const { id_solicitud } = req.params;
    const { id_funcionario, motivo_cancelacion = null } = req.body;

    // ── V0: Campos obligatorios ───────────────────────────────────────────────
    if (!id_solicitud || !id_funcionario) {
        return res.status(400).json({
            error: 'Se requieren id_solicitud e id_funcionario.',
            codigo: 'MSG-ERR-041'
        });
    }

    // ── V4: Motivo máximo 500 caracteres ─────────────────────────────────────
    if (motivo_cancelacion && motivo_cancelacion.length > 500) {
        return res.status(400).json({
            error: 'El motivo de cancelación no puede superar 500 caracteres.',
            codigo: 'MSG-ERR-042'
        });
    }

    try {
        // ── V5: El funcionario debe estar activo ──────────────────────────────
        const [fRows] = await db.query(
            `SELECT id_funcionario, estado, estado_contrato
             FROM funcionarios WHERE id_funcionario = ?`,
            [id_funcionario]
        );

        if (!fRows.length) {
            return res.status(404).json({
                error: 'Funcionario no encontrado.',
                codigo: 'MSG-ERR-035'
            });
        }

        if (fRows[0].estado !== 'activo') {
            return res.status(403).json({
                error: 'El funcionario no está activo.',
                codigo: 'MSG-ERR-036'
            });
        }

        // ── V1: La solicitud debe existir y pertenecer al funcionario ─────────
        const [sRows] = await db.query(
            `SELECT sv.id_solicitud, sv.numero_solicitud, sv.id_nombramiento,
                    sv.fecha_inicio, sv.fecha_fin, sv.dias_solicitados,
                    sv.estado, sv.saldo_antes, sv.saldo_despues,
                    fn.dias_vacaciones_disponibles AS saldo_actual
             FROM solicitudes_vacaciones sv
             JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
             WHERE sv.id_solicitud = ?
               AND sv.id_funcionario = ?`,
            [id_solicitud, id_funcionario]
        );

        if (!sRows.length) {
            return res.status(404).json({
                error: 'Solicitud no encontrada o no pertenece al funcionario.',
                codigo: 'MSG-ERR-043'
            });
        }

        const sol = sRows[0];

        // ── V2: Estado debe ser 'pendiente' o 'aprobada' ──────────────────────
        if (!['pendiente', 'aprobada'].includes(sol.estado)) {
            return res.status(409).json({
                error: `No se puede cancelar una solicitud en estado "${sol.estado}".`,
                codigo: 'MSG-ERR-044',
                estadoActual: sol.estado
            });
        }

        // ── V3: fecha_inicio >= hoy ───────────────────────────────────────────
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const fechaInicio = new Date(sol.fecha_inicio + 'T00:00:00');

        if (fechaInicio < hoy) {
            return res.status(409).json({
                error: 'No se puede cancelar una solicitud cuya fecha de inicio ya pasó.',
                codigo: 'MSG-ERR-045',
                fechaInicio: sol.fecha_inicio
            });
        }

        // ── Todo válido: ejecutar cancelación en transacción ──────────────────
        const estadoAnterior = sol.estado;
        const diasARestaurar = parseFloat(sol.dias_solicitados) || 0;
        const saldoAntesCancelacion = parseFloat(sol.saldo_actual) || 0;
        const saldoDespuesCancelacion = saldoAntesCancelacion + diasARestaurar;

        // 1. Cambiar estado de la solicitud
        await db.query(
            `UPDATE solicitudes_vacaciones
             SET estado = 'cancelada',
                 fecha_modificacion = NOW(),
                 motivo_cancelacion = ?
             WHERE id_solicitud = ?`,
            [motivo_cancelacion, id_solicitud]
        );

        // 2. Restaurar días al nombramiento
        await db.query(
            `UPDATE funcionarios_nombramientos
             SET dias_vacaciones_disponibles = dias_vacaciones_disponibles + ?
             WHERE id_nombramiento = ?`,
            [diasARestaurar, sol.id_nombramiento]
        );

        // 3. Registrar en historial
        const comentarioHist = motivo_cancelacion
            ? `Cancelación solicitada por el funcionario. Motivo: ${motivo_cancelacion}`
            : 'Cancelación solicitada por el funcionario.';

        await db.query(
            `INSERT INTO historial_solicitudes
                (id_solicitud, accion, id_usuario, estado_anterior, estado_nuevo, comentario)
             VALUES (?, 'cancelacion', ?, ?, 'cancelada', ?)`,
            [id_solicitud, id_funcionario, estadoAnterior, comentarioHist]
        );

        // 4. Si estaba aprobada, marcar para notificación GIRH
        const requiereGirh = estadoAnterior === 'aprobada';

        if (requiereGirh) {
            // Registrar aviso GIRH (tabla notificaciones_girh si existe, de lo contrario solo en historial)
            await db.query(
                `INSERT INTO historial_solicitudes
                    (id_solicitud, accion, id_usuario, estado_anterior, estado_nuevo, comentario)
                 VALUES (?, 'notificacion_girh', ?, 'aprobada', 'cancelada', 'Cancelación de solicitud aprobada. GIRH debe actualizar registro de control manualmente (PA-GIRH-10 §5.1.5.1 y §5.1.5.2).')`,
                [id_solicitud, id_funcionario]
            ).catch(() => {
                // Si falla la notificación GIRH no revertimos la cancelación principal
                console.warn('[cancelar.controller] No se pudo registrar notificación GIRH para solicitud', id_solicitud);
            });
        }

        const codigoRespuesta = requiereGirh ? 'MSG-CAN-002' : 'MSG-CAN-001';
        const mensajeRespuesta = requiereGirh
            ? 'Solicitud aprobada cancelada exitosamente. El GIRH ha sido notificado para actualizar el registro de control.'
            : 'Solicitud cancelada exitosamente.';

        return res.json({
            mensaje: mensajeRespuesta,
            codigo: codigoRespuesta,
            id_solicitud: parseInt(id_solicitud),
            numero_solicitud: sol.numero_solicitud,
            estado_anterior: estadoAnterior,
            dias_restaurados: diasARestaurar,
            saldo_antes_cancelacion: saldoAntesCancelacion,
            saldo_despues_cancelacion: saldoDespuesCancelacion,
            requiere_actualizacion_girh: requiereGirh
        });

    } catch (err) {
        console.error('[cancelar.controller] cancelar error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};