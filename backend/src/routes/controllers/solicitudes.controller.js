// src/routes/controllers/solicitudes.controller.js
'use strict';

const db = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Genera número de solicitud formato SVC-YYYY-NNNN */
async function generarNumeroSolicitud() {
    const anio = new Date().getFullYear();
    const [rows] = await db.query(
        `SELECT COUNT(*) AS total FROM solicitudes_vacaciones
         WHERE YEAR(fecha_creacion) = ?`,
        [anio]
    );
    const n = (rows[0].total || 0) + 1;
    return `SVC-${anio}-${String(n).padStart(4, '0')}`;
}

/**
 * Cuenta los días hábiles entre dos fechas (inclusivo) usando calendario_laboral.
 * Un día hábil tiene es_laborable = 1 en la BD.
 * Retorna también la lista de fechas hábiles (para detalle_vacaciones).
 */
async function calcularDiasHabiles(fechaInicio, fechaFin) {
    const [rows] = await db.query(
        `SELECT fecha, id_calendario, descripcion
         FROM calendario_laboral
         WHERE fecha BETWEEN ? AND ?
           AND es_laborable = 1
         ORDER BY fecha ASC`,
        [fechaInicio, fechaFin]
    );
    return {
        cantidad: rows.length,
        dias: rows   // [{ fecha, id_calendario, descripcion }]
    };
}

/**
 * Verifica si una fecha cae en un día no laborable (feriado o fin de semana).
 * Retorna { esLaboral: bool, descripcion: string|null }
 */
async function verificarDia(fecha) {
    const [rows] = await db.query(
        `SELECT es_laborable, descripcion, tipo_dia
         FROM calendario_laboral WHERE fecha = ?`,
        [fecha]
    );
    if (!rows.length) {
        const dow = new Date(fecha + 'T00:00:00').getDay();
        return { esLaboral: dow !== 0 && dow !== 6, descripcion: null };
    }
    return {
        esLaboral: !!rows[0].es_laborable,
        descripcion: rows[0].descripcion,
        tipoDia: rows[0].tipo_dia
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/solicitudes  —  Registrar Solicitud
// ─────────────────────────────────────────────────────────────────────────────
exports.registrar = async (req, res) => {
    const {
        id_funcionario,
        id_nombramiento,
        fecha_inicio,
        fecha_fin,
        motivo = null,
        modalidad = null,
        id_periodo_lectivo = null
    } = req.body;

    // ── V1: Campos obligatorios ───────────────────────────────────────────────
    if (!id_funcionario || !id_nombramiento || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({
            error: 'Los campos id_funcionario, id_nombramiento, fecha_inicio y fecha_fin son obligatorios.',
            codigo: 'MSG-ERR-030'
        });
    }

    // ── V2: Validar formato de fechas ─────────────────────────────────────────
    const reDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!reDate.test(fecha_inicio) || !reDate.test(fecha_fin)) {
        return res.status(400).json({
            error: 'Las fechas deben tener el formato YYYY-MM-DD.',
            codigo: 'MSG-ERR-031'
        });
    }

    const dInicio = new Date(fecha_inicio + 'T00:00:00');
    const dFin = new Date(fecha_fin + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    if (dInicio < hoy) {
        return res.status(400).json({
            error: 'La fecha de inicio no puede ser anterior a hoy.',
            codigo: 'MSG-ERR-032'
        });
    }

    if (dFin < dInicio) {
        return res.status(400).json({
            error: 'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
            codigo: 'MSG-ERR-033'
        });
    }

    // ── V3: Motivo máximo 500 caracteres ─────────────────────────────────────
    if (motivo && motivo.length > 500) {
        return res.status(400).json({
            error: 'El motivo no puede superar 500 caracteres.',
            codigo: 'MSG-ERR-034'
        });
    }

    try {
        // ── V4: El funcionario debe existir y estar activo ────────────────────
        const [fRows] = await db.query(
            `SELECT id_funcionario, nombre, apellido1, estado, estado_contrato,
                    fecha_ingreso, fecha_nombramiento,
                    dias_vacaciones_disponibles, dias_vacaciones_acumulados
             FROM funcionarios
             WHERE id_funcionario = ?`,
            [id_funcionario]
        );

        if (!fRows.length) {
            return res.status(404).json({
                error: 'Funcionario no encontrado.',
                codigo: 'MSG-ERR-035'
            });
        }

        const funcionario = fRows[0];

        if (funcionario.estado !== 'activo') {
            return res.status(403).json({
                error: 'El funcionario no está activo.',
                codigo: 'MSG-ERR-036'
            });
        }

        if (funcionario.estado_contrato !== 'activo') {
            return res.status(403).json({
                error: 'El contrato del funcionario no está activo.',
                codigo: 'MSG-ERR-021'
            });
        }

        // ── V5: El nombramiento debe existir, pertenecer al funcionario y estar activo ──
        const [nRows] = await db.query(
    `SELECT fn.id_nombramiento, fn.id_tipo_nombramiento,
            fn.numero_nombramiento, fn.fecha_nombramiento,
            fn.fecha_fin_nombramiento, fn.en_periodo_prueba,
            fn.fecha_fin_periodo_prueba, fn.es_activo,
            fn.id_periodo_lectivo,
            fn.dias_vacaciones_disponibles,
            fn.dias_vacaciones_acumulados,
            tn.nombre_tipo, tn.es_docente_interino,
            tn.semanas_antiguedad_minima,
            tn.dias_vacaciones_anuales,
            tn.dias_acumulacion_mensual_tramo1,
            tn.dias_acumulacion_mensual_tramo2
     FROM funcionarios_nombramientos fn
     JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
     WHERE fn.id_nombramiento = ?
       AND fn.id_funcionario  = ?
       AND fn.es_activo = 1`,
    [id_nombramiento, id_funcionario]
);

        if (!nRows.length) {
            return res.status(400).json({
                error: 'El nombramiento no existe, no pertenece al funcionario o no está activo.',
                codigo: 'MSG-ERR-011'
            });
        }

        const nom = nRows[0];

        // ── V6: Antigüedad mínima ─────────────────────────────────────────────
        const fechaReferencia = nom.fecha_nombramiento || funcionario.fecha_ingreso;
        if (fechaReferencia) {
            const semanasTrabajadas = Math.floor(
                (hoy - new Date(fechaReferencia)) / (7 * 24 * 60 * 60 * 1000)
            );
            const semMinimas = nom.semanas_antiguedad_minima || 50;
            if (semanasTrabajadas < semMinimas) {
                return res.status(400).json({
                    error: `No cumple la antigüedad mínima requerida. Lleva ${semanasTrabajadas} semanas de ${semMinimas} requeridas.`,
                    codigo: 'MSG-ERR-012',
                    semanasTrabajadas,
                    semanasRequeridas: semMinimas
                });
            }
        }

        // ── V7: Si es docente interino, validar modalidad ─────────────────────
        if (nom.es_docente_interino) {
            const modalidadesValidas = ['tiempo', 'colones'];
            if (!modalidad || !modalidadesValidas.includes(modalidad)) {
                return res.status(400).json({
                    error: 'Para nombramiento Docente/Docente-Adm. Interino debe indicar la modalidad: "tiempo" o "colones".',
                    codigo: 'MSG-ERR-013'
                });
            }
        }

        // ── V8: Validar fechas contra calendario_laboral ──────────────────────
        const diaInicio = await verificarDia(fecha_inicio);
        const diaFin = await verificarDia(fecha_fin);

        const advertencias = [];
        if (!diaInicio.esLaboral) {
            advertencias.push(`La fecha de inicio (${fecha_inicio}) es ${diaInicio.tipoDia || 'no laborable'}${diaInicio.descripcion ? ': ' + diaInicio.descripcion : ''}.`);
        }
        if (!diaFin.esLaboral) {
            advertencias.push(`La fecha de fin (${fecha_fin}) es ${diaFin.tipoDia || 'no laborable'}${diaFin.descripcion ? ': ' + diaFin.descripcion : ''}.`);
        }

        // ── V9: Contar días hábiles reales desde calendario_laboral ───────────
        const { cantidad: diasHabiles, dias: listaDias } =
            await calcularDiasHabiles(fecha_inicio, fecha_fin);

        if (diasHabiles === 0) {
            return res.status(400).json({
                error: 'El rango de fechas seleccionado no contiene días hábiles.',
                codigo: 'MSG-ERR-014'
            });
        }

        // ── V10: Verificar saldo suficiente ───────────────────────────────────
        const saldoDisponible = parseFloat(nom.dias_vacaciones_disponibles) || 0;

        if (diasHabiles > saldoDisponible) {
            return res.status(400).json({
                error: `Saldo insuficiente. Solicitás ${diasHabiles} días hábiles pero solo tenés ${saldoDisponible} disponibles.`,
                codigo: 'MSG-ERR-015',
                diasSolicitados: diasHabiles,
                saldoDisponible
            });
        }

        // ── V11: No debe haber solicitudes pendientes o aprobadas que se traslapen ──
        const [traslape] = await db.query(
            `SELECT id_solicitud, numero_solicitud, fecha_inicio, fecha_fin, estado
             FROM solicitudes_vacaciones
             WHERE id_funcionario = ?
               AND id_nombramiento = ?
               AND estado IN ('pendiente','aprobada')
               AND fecha_inicio <= ? AND fecha_fin >= ?`,
            [id_funcionario, id_nombramiento, fecha_fin, fecha_inicio]
        );

        if (traslape.length > 0) {
            return res.status(409).json({
                error: `Ya existe una solicitud (${traslape[0].numero_solicitud}) en estado "${traslape[0].estado}" que se traslapa con las fechas solicitadas.`,
                codigo: 'MSG-ERR-016',
                solicitudExistente: traslape[0].numero_solicitud
            });
        }

        // ── Todo válido: registrar solicitud ──────────────────────────────────
        const numeroSolicitud = await generarNumeroSolicitud();
        const saldoDespues = saldoDisponible - diasHabiles;

        const modalidadBD = nom.es_docente_interino
            ? (modalidad === 'colones' ? 'liquidacion_colones' : 'disfrute_en_tiempo')
            : null;

        const [result] = await db.query(
            `INSERT INTO solicitudes_vacaciones
                (numero_solicitud, id_funcionario, id_nombramiento,
                 fecha_inicio, fecha_fin, dias_solicitados,
                 motivo, estado, saldo_antes, saldo_despues,
                 id_periodo_lectivo, modalidad)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)`,
            [
                numeroSolicitud,
                id_funcionario,
                id_nombramiento,
                fecha_inicio,
                fecha_fin,
                diasHabiles,
                motivo,
                saldoDisponible,
                saldoDespues,
                id_periodo_lectivo || nom.id_periodo_lectivo || null,
                modalidadBD
            ]
        );

        const idSolicitud = result.insertId;

        // ── Descontar días del saldo del funcionario ──────────────────────────
        await db.query(
            `UPDATE funcionarios_nombramientos
     SET dias_vacaciones_disponibles = dias_vacaciones_disponibles - ?
     WHERE id_nombramiento = ?`,
            [diasHabiles, id_nombramiento]
        );

        // ── Registrar detalle día a día en detalle_vacaciones ─────────────────
        if (listaDias.length > 0) {
            const valoresDetalle = listaDias.map(d => [idSolicitud, d.fecha, d.id_calendario, 1, d.descripcion || null]);
            await db.query(
                `INSERT INTO detalle_vacaciones (id_solicitud, fecha, id_calendario, contabilizado, observacion)
                 VALUES ?`,
                [valoresDetalle]
            );
        }

        // ── Registrar en historial_solicitudes ────────────────────────────────
        await db.query(
            `INSERT INTO historial_solicitudes
        (id_solicitud, accion, id_usuario, estado_anterior, estado_nuevo, comentario)
     VALUES (?, 'creacion', ?, NULL, 'pendiente', 'Solicitud registrada por el funcionario')`,
            [idSolicitud, id_funcionario]
        );

        return res.status(201).json({
            mensaje: 'Solicitud registrada correctamente.',
            codigo: 'MSG-SVC-001',
            numero_solicitud: numeroSolicitud,
            id_solicitud: idSolicitud,
            dias_solicitados: diasHabiles,
            saldo_antes: saldoDisponible,
            saldo_despues: saldoDespues,
            advertencias: advertencias.length > 0 ? advertencias : undefined
        });

    } catch (err) {
        console.error('[solicitudes.controller] registrar error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.diasHabiles = async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin)
        return res.status(400).json({ error: 'Fechas requeridas.' });
    try {
        const { cantidad } = await calcularDiasHabiles(fecha_inicio, fecha_fin);
        return res.json({ dias_habiles: cantidad });
    } catch(err) {
        return res.status(500).json({ error: 'Error interno.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/solicitudes?id_funcionario=X  —  Consultar solicitudes del funcionario
// ─────────────────────────────────────────────────────────────────────────────
exports.consultar = async (req, res) => {
    const { id_funcionario } = req.query;

    if (!id_funcionario) {
        return res.status(400).json({ error: 'Se requiere id_funcionario.' });
    }

    try {
        const [rows] = await db.query(
            `SELECT sv.id_solicitud, sv.numero_solicitud,
                    sv.fecha_inicio, sv.fecha_fin, sv.dias_solicitados,
                    sv.estado, sv.motivo, sv.modalidad,
                    sv.saldo_antes, sv.saldo_despues,
                    sv.fecha_creacion, sv.fecha_aprobacion,
                    sv.comentarios_aprobador,
                    tn.nombre_tipo,
                    fn.numero_nombramiento
             FROM solicitudes_vacaciones sv
             JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
             JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
             WHERE sv.id_funcionario = ?
             ORDER BY sv.fecha_creacion DESC`,
            [id_funcionario]
        );

        return res.json({ solicitudes: rows });
    } catch (err) {
        console.error('[solicitudes.controller] consultar error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    
};