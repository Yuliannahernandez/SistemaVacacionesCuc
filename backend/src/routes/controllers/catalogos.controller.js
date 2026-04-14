// src/routes/controllers/catalogos.controller.js
'use strict';

const db = require('./db');

// ─── GET /api/catalogos/departamentos ────────────────────────────────────────
exports.getDepartamentos = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id_departamento, nombre_departamento, descripcion
             FROM departamentos
             WHERE estado = 'activo'
             ORDER BY nombre_departamento ASC`
        );
        return res.json(rows);
    } catch (err) {
        console.error('[catalogos.controller] getDepartamentos error:', err.message);
        return res.status(500).json({ error: 'Error al cargar departamentos.' });
    }
};

// ─── GET /api/catalogos/cargos ───────────────────────────────────────────────
exports.getCargos = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id_cargo, nombre_cargo, descripcion, nivel_jerarquico
             FROM cargos
             WHERE estado = 'activo'
             ORDER BY nivel_jerarquico ASC, nombre_cargo ASC`
        );
        return res.json(rows);
    } catch (err) {
        console.error('[catalogos.controller] getCargos error:', err.message);
        return res.status(500).json({ error: 'Error al cargar cargos.' });
    }
};

// ─── GET /api/catalogos/tipos-nombramiento ───────────────────────────────────
// Devuelve todos los campos relevantes para que el front pueda
// mostrar info adicional (días de vacaciones, período de prueba, etc.)
exports.getTiposNombramiento = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                id_tipo_nombramiento,
                nombre_tipo,
                descripcion,
                dias_vacaciones_anuales,
                requiere_periodo_prueba,
                meses_periodo_prueba,
                puede_acumular_vacaciones,
                maximo_dias_acumulados,
                es_docente_interino,
                dias_acumulacion_mensual_tramo1,
                dias_acumulacion_mensual_tramo2,
                semanas_antiguedad_minima
             FROM tipos_nombramiento
             WHERE estado = 'activo'
             ORDER BY nombre_tipo ASC`
        );
        return res.json(rows);
    } catch (err) {
        console.error('[catalogos.controller] getTiposNombramiento error:', err.message);
        return res.status(500).json({ error: 'Error al cargar tipos de nombramiento.' });
    }
};

// ─── GET /api/catalogos/periodos-lectivos ────────────────────────────────────
// Solo períodos activos o futuros para el select del formulario de nombramiento
exports.getPeriodosLectivos = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                id_periodo_lectivo,
                nombre_periodo,
                anio,
                numero_periodo,
                fecha_inicio,
                fecha_fin,
                estado
             FROM periodos_lectivos
             WHERE estado IN ('activo', 'futuro')
             ORDER BY anio DESC, numero_periodo DESC`
        );
        return res.json(rows);
    } catch (err) {
        console.error('[catalogos.controller] getPeriodosLectivos error:', err.message);
        return res.status(500).json({ error: 'Error al cargar períodos lectivos.' });
    }
};