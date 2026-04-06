'use strict';

const db = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (reutilizados de solicitudes.controller)
// ─────────────────────────────────────────────────────────────────────────────

async function calcularDiasHabiles(fechaInicio, fechaFin) {
    const [rows] = await db.query(
        `SELECT fecha, id_calendario, descripcion
         FROM calendario_laboral
         WHERE fecha BETWEEN ? AND ?
           AND es_laborable = 1
         ORDER BY fecha ASC`,
        [fechaInicio, fechaFin]
    );
    return { cantidad: rows.length, dias: rows };
}

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
// GET /api/solicitudes/:id  —  Obtener solicitud para precargar formulario
// ─────────────────────────────────────────────────────────────────────────────
exports.obtener = async (req, res) => {
    const { id } = req.params;
    const { id_funcionario } = req.query;

    if (!id_funcionario) {
        return res.status(400).json({ error: 'Se requiere id_funcionario.', codigo: 'MSG-ERR-040' });
    }

    try {
        const [rows] = await db.query(
            `SELECT sv.id_solicitud, sv.numero_solicitud,
                    sv.id_funcionario, sv.id_nombramiento,
                    sv.fecha_inicio, sv.fecha_fin, sv.dias_solicitados,
                    sv.motivo, sv.estado, sv.modalidad,
                    sv.saldo_antes, sv.saldo_despues,
                    sv.fecha_creacion, sv.id_periodo_lectivo,
                    fn.numero_nombramiento,
                    fn.dias_vacaciones_disponibles AS saldo_actual,
                    fn.dias_vacaciones_acumulados,
                    tn.nombre_tipo, tn.es_docente_interino,
                    tn.semanas_antiguedad_minima,
                    CONCAT(fu.nombre, ' ', fu.apellido1, IFNULL(CONCAT(' ', fu.apellido2),'')) AS nombre_funcionario
             FROM solicitudes_vacaciones sv
             JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
             JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
             JOIN funcionarios fu ON sv.id_funcionario = fu.id_funcionario
             WHERE sv.id_solicitud = ?
               AND sv.id_funcionario = ?`,
            [id, id_funcionario]
        );

        if (!rows.length) {
            return res.status(404).json({
                error: 'Solicitud no encontrada o no pertenece al funcionario.',
                codigo: 'MSG-ERR-041'
            });
        }

        const sol = rows[0];

        // V1: Solo pendientes son modificables
        if (sol.estado !== 'pendiente') {
            return res.status(409).json({
                error: `La solicitud se encuentra en estado "${sol.estado}" y no puede modificarse.`,
                codigo: 'MSG-ERR-042',
                estado: sol.estado
            });
        }

        // Obtener historial
        const [historial] = await db.query(
            `SELECT hs.accion, hs.estado_anterior, hs.estado_nuevo,
                    hs.comentario, hs.fecha_accion,
                    CONCAT(fu.nombre,' ',fu.apellido1) AS usuario
             FROM historial_solicitudes hs
             LEFT JOIN funcionarios fu ON hs.id_usuario = fu.id_funcionario
             WHERE hs.id_solicitud = ?
             ORDER BY hs.fecha_accion ASC`,
            [id]
        );

        return res.json({ solicitud: sol, historial });

    } catch (err) {
        console.error('[modificar.controller] obtener error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/solicitudes/:id  —  Modificar Solicitud
// ─────────────────────────────────────────────────────────────────────────────
exports.modificar = async (req, res) => {
    const { id } = req.params;
    const {
        id_funcionario,
        fecha_inicio,
        fecha_fin,
        motivo = null
    } = req.body;

    // ── V1: Campos obligatorios ───────────────────────────────────────────────
    if (!id_funcionario || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({
            error: 'Los campos id_funcionario, fecha_inicio y fecha_fin son obligatorios.',
            codigo: 'MSG-ERR-043'
        });
    }

    // ── V2: Formato de fechas ─────────────────────────────────────────────────
    const reDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!reDate.test(fecha_inicio) || !reDate.test(fecha_fin)) {
        return res.status(400).json({
            error: 'Las fechas deben tener el formato YYYY-MM-DD.',
            codigo: 'MSG-ERR-031'
        });
    }

    const dInicio = new Date(fecha_inicio + 'T00:00:00');
    const dFin    = new Date(fecha_fin    + 'T00:00:00');
    const hoy     = new Date(); hoy.setHours(0, 0, 0, 0);

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

    // ── V3: Motivo máx 500 caracteres ────────────────────────────────────────
    if (motivo && motivo.length > 500) {
        return res.status(400).json({
            error: 'El motivo no puede superar 500 caracteres.',
            codigo: 'MSG-ERR-034'
        });
    }

    try {
        // ── V4: Solicitud debe existir, pertenecer al funcionario y estar Pendiente ──
        const [solRows] = await db.query(
            `SELECT sv.id_solicitud, sv.numero_solicitud,
                    sv.id_nombramiento, sv.estado,
                    sv.fecha_inicio AS fi_original, sv.fecha_fin AS ff_original,
                    sv.dias_solicitados AS dias_originales,
                    sv.motivo AS motivo_original,
                    sv.saldo_antes, sv.saldo_despues,
                    fn.dias_vacaciones_disponibles AS saldo_actual,
                    tn.nombre_tipo, tn.es_docente_interino,
                    sv.modalidad, sv.id_periodo_lectivo
             FROM solicitudes_vacaciones sv
             JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
             JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
             WHERE sv.id_solicitud = ?
               AND sv.id_funcionario = ?`,
            [id, id_funcionario]
        );

        if (!solRows.length) {
            return res.status(404).json({
                error: 'Solicitud no encontrada o no pertenece al funcionario.',
                codigo: 'MSG-ERR-041'
            });
        }

        const sol = solRows[0];

        if (sol.estado !== 'pendiente') {
            return res.status(409).json({
                error: `La solicitud se encuentra en estado "${sol.estado}" y no puede modificarse.`,
                codigo: 'MSG-ERR-042',
                estado: sol.estado
            });
        }

        // ── V5: Detectar si hay cambios reales ───────────────────────────────
        const sinCambioFechas = (fecha_inicio === sol.fi_original && fecha_fin === sol.ff_original);
        const sinCambioMotivo = ((motivo || '') === (sol.motivo_original || ''));
        if (sinCambioFechas && sinCambioMotivo) {
            return res.status(400).json({
                error: 'No se detectaron cambios respecto a la solicitud original.',
                codigo: 'MSG-ERR-044'
            });
        }

        // ── V6: Validar días hábiles en inicio y fin ──────────────────────────
        const diaInicio = await verificarDia(fecha_inicio);
        const diaFin    = await verificarDia(fecha_fin);
        const advertencias = [];
        if (!diaInicio.esLaboral)
            advertencias.push(`La fecha de inicio (${fecha_inicio}) es ${diaInicio.tipoDia || 'no laborable'}${diaInicio.descripcion ? ': ' + diaInicio.descripcion : ''}.`);
        if (!diaFin.esLaboral)
            advertencias.push(`La fecha de fin (${fecha_fin}) es ${diaFin.tipoDia || 'no laborable'}${diaFin.descripcion ? ': ' + diaFin.descripcion : ''}.`);

        // ── V7: Calcular días hábiles nuevos ──────────────────────────────────
        const { cantidad: diasNuevos, dias: listaDias } =
            await calcularDiasHabiles(fecha_inicio, fecha_fin);

        if (diasNuevos === 0) {
            return res.status(400).json({
                error: 'El rango de fechas seleccionado no contiene días hábiles.',
                codigo: 'MSG-ERR-014'
            });
        }

        // ── V8: Verificar saldo suficiente ────────────────────────────────────
        // El saldo actual ya descontó los días originales.
        // Para modificar: saldo real disponible = saldo_actual + dias_originales
        const saldoReal = parseFloat(sol.saldo_actual) + sol.dias_originales;

        if (diasNuevos > saldoReal) {
            return res.status(400).json({
                error: `Saldo insuficiente. Necesitás ${diasNuevos} días hábiles pero solo tenés ${saldoReal} disponibles.`,
                codigo: 'MSG-ERR-015',
                diasSolicitados: diasNuevos,
                saldoDisponible: saldoReal
            });
        }

        // ── V9: Verificar traslape con otras solicitudes (excluyendo la actual) ──
        const [traslape] = await db.query(
            `SELECT id_solicitud, numero_solicitud, fecha_inicio, fecha_fin, estado
             FROM solicitudes_vacaciones
             WHERE id_funcionario = ?
               AND id_nombramiento = ?
               AND id_solicitud != ?
               AND estado IN ('pendiente','aprobada')
               AND fecha_inicio <= ? AND fecha_fin >= ?`,
            [id_funcionario, sol.id_nombramiento, id, fecha_fin, fecha_inicio]
        );

        if (traslape.length > 0) {
            return res.status(409).json({
                error: `Ya existe otra solicitud (${traslape[0].numero_solicitud}) en estado "${traslape[0].estado}" que se traslapa con las nuevas fechas.`,
                codigo: 'MSG-ERR-016',
                solicitudExistente: traslape[0].numero_solicitud
            });
        }

        // ── Todo válido: actualizar ───────────────────────────────────────────
        const diferenciaDias = diasNuevos - sol.dias_originales;
        const nuevoSaldoDespues = parseFloat(sol.saldo_antes) - diasNuevos;

        // 1. Actualizar la solicitud
        await db.query(
            `UPDATE solicitudes_vacaciones
             SET fecha_inicio    = ?,
                 fecha_fin       = ?,
                 dias_solicitados = ?,
                 motivo          = ?,
                 saldo_despues   = ?,
                 fecha_modificacion = NOW()
             WHERE id_solicitud = ?`,
            [fecha_inicio, fecha_fin, diasNuevos, motivo, nuevoSaldoDespues, id]
        );

        // 2. Ajustar saldo del nombramiento (reintegrar original, descontar nuevo)
        await db.query(
            `UPDATE funcionarios_nombramientos
             SET dias_vacaciones_disponibles = dias_vacaciones_disponibles - ?
             WHERE id_nombramiento = ?`,
            [diferenciaDias, sol.id_nombramiento]
        );

        // 3. Actualizar detalle_vacaciones: borrar días anteriores e insertar nuevos
        await db.query(
            `DELETE FROM detalle_vacaciones WHERE id_solicitud = ?`,
            [id]
        );
        if (listaDias.length > 0) {
            const valoresDetalle = listaDias.map(d => [id, d.fecha, d.id_calendario, 1, d.descripcion || null]);
            await db.query(
                `INSERT INTO detalle_vacaciones (id_solicitud, fecha, id_calendario, contabilizado, observacion) VALUES ?`,
                [valoresDetalle]
            );
        }

        // 4. Registrar en historial_solicitudes
        const comentarioHistorial = `Solicitud modificada por el funcionario. Período: ${fecha_inicio} al ${fecha_fin} (${diasNuevos} días hábiles).`;
        await db.query(
            `INSERT INTO historial_solicitudes
                (id_solicitud, accion, id_usuario, estado_anterior, estado_nuevo, comentario)
             VALUES (?, 'modificacion', ?, 'pendiente', 'pendiente', ?)`,
            [id, id_funcionario, comentarioHistorial]
        );

        return res.json({
            mensaje: 'Solicitud modificada correctamente. Permanece en estado Pendiente.',
            codigo: 'MSG-SVC-003',
            id_solicitud: parseInt(id),
            numero_solicitud: sol.numero_solicitud,
            dias_anteriores: sol.dias_originales,
            dias_nuevos: diasNuevos,
            diferencia_dias: diferenciaDias,
            saldo_antes: parseFloat(sol.saldo_antes),
            saldo_despues: nuevoSaldoDespues,
            advertencias: advertencias.length > 0 ? advertencias : undefined
        });

    } catch (err) {
        console.error('[modificar.controller] modificar error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};