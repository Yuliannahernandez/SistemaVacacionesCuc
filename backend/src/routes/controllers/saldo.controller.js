// src/routes/controllers/saldo.controller.js
// Implementa PA-GIRH-10 (v1, 10/12/2020) y PA-GIRH-04 (v1, 14/06/2017)
// Colegio Universitario de Cartago – GIRH
'use strict';

const db = require('./db');

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTES NORMATIVAS
// ═════════════════════════════════════════════════════════════════════════════

const SEMANAS_MINIMAS          = 50;    // PA-GIRH-10 §1.2.1.1 – mínimo para primer derecho
const MESES_CAMBIO_TRAMO       = 60;    // 5 años × 12 meses – cambio de tramo interinos
const DIAS_MES_TRAMO1          = 1.5;   // PA-GIRH-10 §1.2.3.1
const DIAS_MES_TRAMO2          = 2.5;   // PA-GIRH-10 §1.2.3.2
const DIAS_MES_REGLA_2023      = 1.67;  // Regla 2023 (resolución posterior)
const FECHA_CORTE_REGLA_2023   = new Date('2023-01-01');
const DIAS_PERSONALES_TRAMO1   = 5;     // PA-GIRH-10 §1.2.1.1 – días hábiles personales
const DIAS_TOTALES_TRAMO2      = 30;    // PA-GIRH-10 §1.2.1.2 – días hábiles totales (incl. colectivas)

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS DE FECHA
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Años de servicio por diferencia exacta de fechas.
 * Solo para mostrar en pantalla – NO usar para tramos normativos.
 */
function calcularAniosServicio(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.floor(
    (Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
}

/**
 * Antigüedad en años completos respetando mes y día del calendario.
 * Fuente normativa para tramos de acumulación (1–5 / 6+).
 */
function calcularAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return 0;
  const hoy = new Date();
  const ing = new Date(fechaIngreso);
  let anios = hoy.getFullYear() - ing.getFullYear();
  const dm = hoy.getMonth() - ing.getMonth();
  if (dm < 0 || (dm === 0 && hoy.getDate() < ing.getDate())) anios--;
  return Math.max(anios, 0);
}

/**
 * Semanas completas laboradas desde una fecha de referencia hasta hoy.
 * Usado para validar el mínimo de 50 semanas (PA-GIRH-10 §1.2.1.1).
 */
function semanasDesde(fecha) {
  if (!fecha) return 0;
  return Math.floor(
    (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );
}

/**
 * Meses completos trabajados desde una fecha de referencia hasta hoy.
 */
function mesesDesde(fecha) {
  if (!fecha) return 0;
  return Math.max(
    Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
    0
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LÓGICA NORMATIVA CENTRAL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Determina si un nombramiento ya superó el mínimo de 50 semanas continuas.
 * PA-GIRH-10 §1.2.1.1: "Después de 50 semanas de trabajo continuo..."
 */
function cumpleMinimoDeSemanas(nom) {
  const semanasMinimas = parseInt(nom.semanas_antiguedad_minima) || SEMANAS_MINIMAS;
  const semanasLaboradas = semanasDesde(nom.fecha_nombramiento);
  return { cumple: semanasLaboradas >= semanasMinimas, semanas: semanasLaboradas, minimo: semanasMinimas };
}

/**
 * Retorna la regla de acumulación que aplica, con código y descripción completos.
 * Orden de precedencia:
 *   1. Sin nombramiento → 0 días
 *   2. No cumple 50 semanas mínimas → 0 días (aún no tiene derecho)
 *   3. Docente interino regla 2023 → 1.67 días/mes
 *   4. Docente interino tramo 1 (1–5 años) → 1.5 días/mes
 *   5. Docente interino tramo 2 (6+ años) → 2.5 días/mes
 *   6. No-interino tramo 1 (1–5 años) → colectivas + 5 días personales
 *   7. No-interino tramo 2 (6+ años) → 30 días hábiles (colectivas incluidas)
 */
function obtenerReglaAcumulacion(nom, antiguedad) {
  const { cumple, semanas, minimo } = cumpleMinimoDeSemanas(nom);

  if (!cumple) {
    return {
      codigo:           'PA-GIRH-10 §1.2.1.1',
      descripcion:      `Aún no cumple las ${minimo} semanas mínimas (lleva ${semanas} semanas)`,
      tipo:             'sin_derecho',
      dias_por_periodo: 0,
    };
  }

  if (nom.es_docente_interino) {
    // ── Regla 2023 (aplica_regla_2023 en BD o fecha de nombramiento >= 2023) ──
    const fechaNom = nom.fecha_nombramiento ? new Date(nom.fecha_nombramiento) : null;
    const usaRegla2023 = !!nom.aplica_regla_2023 || (fechaNom && fechaNom >= FECHA_CORTE_REGLA_2023);

    if (usaRegla2023) {
      const tasa = parseFloat(nom.dias_acumulacion_mensual_regla2023) || DIAS_MES_REGLA_2023;
      return {
        codigo:           'PA-GIRH-10 §1.2.3 (Resolución 2023)',
        descripcion:      `Docente interino: ${tasa} días hábiles/mes (regla 2023, independiente de antigüedad)`,
        tipo:             'mensual',
        dias_por_periodo: tasa,
      };
    }

    if (antiguedad < 6) {
      const tasa = parseFloat(nom.dias_acumulacion_mensual_tramo1) || DIAS_MES_TRAMO1;
      return {
        codigo:           'PA-GIRH-10 §1.2.3.1',
        descripcion:      `Docente interino: ${tasa} días hábiles/mes (1–5 años de servicio)`,
        tipo:             'mensual',
        dias_por_periodo: tasa,
      };
    }

    const tasa = parseFloat(nom.dias_acumulacion_mensual_tramo2) || DIAS_MES_TRAMO2;
    return {
      codigo:           'PA-GIRH-10 §1.2.3.2',
      descripcion:      `Docente interino: ${tasa} días hábiles/mes (6+ años de servicio)`,
      tipo:             'mensual',
      dias_por_periodo: tasa,
    };
  }

  // ── No-interino (administrativo o docente en propiedad) ──
  if (antiguedad < 6) {
    const diasPersonales = parseFloat(nom.dias_personales_tramo1) || DIAS_PERSONALES_TRAMO1;
    return {
      codigo:           'PA-GIRH-10 §1.2.1.1 / §1.2.2.1',
      descripcion:      `Vacaciones colectivas art.50 RAT + ${diasPersonales} días hábiles personales (1–5 años)`,
      tipo:             'anual_tramo1',
      dias_por_periodo: diasPersonales, // solo los personales; las colectivas son institucionales
    };
  }

  const diasTotales = parseFloat(nom.dias_totales_tramo2) || DIAS_TOTALES_TRAMO2;
  return {
    codigo:           'PA-GIRH-10 §1.2.1.2 / §1.2.2.2',
    descripcion:      `${diasTotales} días hábiles anuales (incluye vacaciones colectivas art.50 RAT, 6+ años)`,
    tipo:             'anual_tramo2',
    dias_por_periodo: diasTotales,
  };
}

/**
 * Calcula los días acumulados EN TIEMPO REAL para un nombramiento.
 *
 * Reglas PA-GIRH-10:
 *
 * Interinos:
 *   - Acumulan por mes laborado según tramo/regla
 *   - Del total se RESTAN las vacaciones colectivas art.50 RAT (§1.2.3.3)
 *   - Tope = maximo_dias_acumulados del tipo de nombramiento
 *
 * No-interinos:
 *   - Tramo 1 (1–5 años): 5 días hábiles personales por período anual
 *   - Tramo 2 (6+ años): 30 días hábiles totales por período anual
 *   - Requieren mínimo 50 semanas para el primer derecho (§1.2.1.1)
 *   - NO acumulan entre años: cada año renuevan su dotación
 */
function calcularDiasAcumuladosPorNom(nom, antiguedad = 0) {
  const { cumple } = cumpleMinimoDeSemanas(nom);
  if (!cumple) return 0;

  const mesesTrabajados  = mesesDesde(nom.fecha_nombramiento);
  const max              = parseFloat(nom.maximo_dias_acumulados) || 30;
  const regla            = obtenerReglaAcumulacion(nom, antiguedad);

  // ── DOCENTE INTERINO ──────────────────────────────────────────────────────
  if (nom.es_docente_interino) {
    const tasa = regla.dias_por_periodo;
    const acumBruto = mesesTrabajados * tasa;

    // Restar vacaciones colectivas art.50 RAT ya descontadas en este nombramiento
    // PA-GIRH-10 §1.2.3.3
    const diasColectivas = parseFloat(nom.dias_colectivas_art50) || 0;
    const diasColDescontados = parseFloat(nom.dias_colectivas_descontados) || 0;

    // Solo restamos colectivas hasta el máximo configurado para este tipo
    const descuentoColectivas = Math.min(diasColDescontados, diasColectivas);
    const acumNeto = Math.max(acumBruto - descuentoColectivas, 0);

    return Math.min(Math.round(acumNeto * 100) / 100, max);
  }

  // ── NO INTERINO (propiedad administrativo / docente en propiedad) ─────────
  // La normativa establece una dotación POR PERÍODO ANUAL, no acumulativa.
  // Tramo 1: 5 días hábiles personales (más las colectivas institucionales)
  // Tramo 2: 30 días hábiles totales (las colectivas están incluidas)
  // Los días disponibles son los del período anual actual, menos los ya usados.
  // No se suman años anteriores (no-interinos no acumulan entre períodos).

  if (regla.tipo === 'anual_tramo1') {
    // Dotación del período actual: solo los 5 días personales
    // Las colectivas son obligatorias institucionales, no se "acumulan" aquí
    return parseFloat(nom.dias_personales_tramo1) || DIAS_PERSONALES_TRAMO1;
  }

  if (regla.tipo === 'anual_tramo2') {
    return parseFloat(nom.dias_totales_tramo2) || DIAS_TOTALES_TRAMO2;
  }

  return 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// QUERIES REUTILIZABLES
// ═════════════════════════════════════════════════════════════════════════════

async function getNombramientosActivos(id_funcionario) {
  const [rows] = await db.query(
    `SELECT fn.id_nombramiento,
            fn.numero_nombramiento,
            fn.fecha_nombramiento,
            fn.fecha_fin_nombramiento,
            fn.en_periodo_prueba,
            fn.id_periodo_lectivo,
            fn.dias_colectivas_descontados,
            tn.id_tipo_nombramiento,
            tn.nombre_tipo,
            tn.es_docente_interino,
            tn.dias_vacaciones_anuales,
            tn.maximo_dias_acumulados,
            tn.dias_acumulacion_mensual_tramo1,
            tn.dias_acumulacion_mensual_tramo2,
            tn.dias_acumulacion_mensual_regla2023,
            tn.semanas_antiguedad_minima,
            tn.dias_personales_tramo1,
            tn.dias_totales_tramo2,
            tn.dias_colectivas_art50,
            tn.aplica_regla_2023
     FROM funcionarios_nombramientos fn
     JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
     WHERE fn.id_funcionario = ? AND fn.es_activo = 1
     ORDER BY fn.fecha_nombramiento DESC`,
    [id_funcionario]
  );
  return rows;
}

/**
 * Días usados en solicitudes PERSONALES aprobadas para un nombramiento.
 * No incluye las colectivas (tipo='colectiva') porque esas se descuentan aparte.
 */
async function getDiasUsadosPorNom(id_funcionario, id_nombramiento) {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(dias_solicitados), 0) AS dias_usados
     FROM solicitudes_vacaciones
     WHERE id_funcionario  = ?
       AND id_nombramiento = ?
       AND estado          = 'aprobada'
       AND tipo_solicitud  = 'personal'`,
    [id_funcionario, id_nombramiento]
  );
  return parseFloat(rows[0].dias_usados) || 0;
}

/**
 * Días colectivos ya aplicados a un nombramiento concreto.
 */
async function getDiasColectivasAplicados(id_nombramiento) {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(dias_solicitados), 0) AS dias_col
     FROM solicitudes_vacaciones
     WHERE id_nombramiento = ?
       AND estado          = 'aprobada'
       AND tipo_solicitud  = 'colectiva'`,
    [id_nombramiento]
  );
  return parseFloat(rows[0].dias_col) || 0;
}

/**
 * Construye el array de saldos por nombramiento, todo en tiempo real.
 * Es la función central que usa el resto de endpoints.
 */
async function buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad) {
  return Promise.all(nombramientos.map(async (nom) => {
       const semanasInfo   = cumpleMinimoDeSemanas(nom);
const antiguedadNom = calcularAntiguedad(nom.fecha_nombramiento); // ← por nombramiento
const regla         = obtenerReglaAcumulacion(nom, antiguedadNom);

    // Enriquecer nom con días colectivos reales desde solicitudes_vacaciones
    const diasColAplicados = await getDiasColectivasAplicados(nom.id_nombramiento);
    const nomEnriquecido = { ...nom, dias_colectivas_descontados: diasColAplicados };

    const diasAcumulados = calcularDiasAcumuladosPorNom(nomEnriquecido, antiguedadNom);
    const diasUsados       = await getDiasUsadosPorNom(id_funcionario, nom.id_nombramiento);
    const diasDisponibles  = Math.max(diasAcumulados - diasUsados, 0);

    return {
      id_nombramiento:          nom.id_nombramiento,
      id_tipo_nombramiento:     nom.id_tipo_nombramiento,
      nombre_tipo:              nom.nombre_tipo,
      numero_nombramiento:      nom.numero_nombramiento || null,
      fecha_nombramiento:       nom.fecha_nombramiento,
      fecha_fin_nombramiento:   nom.fecha_fin_nombramiento,
      es_docente_interino:      !!nom.es_docente_interino,
      en_periodo_prueba:        !!nom.en_periodo_prueba,
      id_periodo_lectivo:       nom.id_periodo_lectivo,
      // Derecho
      cumple_minimo_semanas:    semanasInfo.cumple,
      semanas_laboradas:        semanasInfo.semanas,
      semanas_minimas:          semanasInfo.minimo,
      // Saldo
      dias_acumulados:          diasAcumulados,
      dias_colectivas_descontados: diasColAplicados,
      dias_usados:              diasUsados,
      dias_disponibles:         diasDisponibles,
      // Regla aplicada
      regla_codigo:             regla.codigo,
      regla_descripcion:        regla.descripcion,
      regla_tipo:               regla.tipo,
      dias_por_periodo:         regla.dias_por_periodo,
      fecha_calculo:            new Date().toISOString().split('T')[0],
    };
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/saldo/calculo/:id_funcionario
// ═════════════════════════════════════════════════════════════════════════════
const getCalculoSaldo = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [fRows] = await db.query(
      `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2,
              f.fecha_ingreso, d.nombre_departamento, f.rol
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (!fRows.length) return res.status(404).json({ error: 'Funcionario no encontrado' });

    const f          = fRows[0];
    const antiguedad = calcularAntiguedad(f.fecha_ingreso);
    const anios      = calcularAniosServicio(f.fecha_ingreso);

    const nombramientos = await getNombramientosActivos(id_funcionario);
    const saldosPorNom  = await buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad);

    const totalAcumulados  = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_acumulados,  0) * 100) / 100;
    const totalUsados      = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_usados,      0) * 100) / 100;
    const totalDisponibles = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_disponibles, 0) * 100) / 100;

    const primerSaldo = saldosPorNom[0] || {
      dias_acumulados: 0, dias_usados: 0, dias_disponibles: 0,
      regla_codigo: 'N/A', regla_descripcion: 'Sin nombramiento activo',
      fecha_calculo: new Date().toISOString().split('T')[0],
    };

    return res.json({
      funcionario: {
        id_funcionario:    f.id_funcionario,
        nombre:            `${f.nombre} ${f.apellido1} ${f.apellido2 || ''}`.trim(),
        departamento:      f.nombre_departamento,
        tipo_nombramiento: primerSaldo.nombre_tipo || 'No asignado',
        fecha_ingreso:     f.fecha_ingreso,
        anios_servicio:    anios,
        antiguedad_anios:  antiguedad,
      },
      // Compatibilidad saldo.html (primer nombramiento)
      calculo_saldo: {
        dias_acumulados:                primerSaldo.dias_acumulados,
        dias_disfrutados:               primerSaldo.dias_usados,
        dias_disponibles:               primerSaldo.dias_disponibles,
        saldo_calculado_en_tiempo_real: primerSaldo.dias_disponibles,
        regla_codigo:                   primerSaldo.regla_codigo,
        regla:                          primerSaldo.regla_descripcion,
        fecha_calculo:                  primerSaldo.fecha_calculo,
      },
      totales: { dias_acumulados: totalAcumulados, dias_usados: totalUsados, dias_disponibles: totalDisponibles },
      saldos_por_nombramiento: saldosPorNom,
    });
  } catch (err) {
    console.error('getCalculoSaldo:', err);
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/saldo/acumulacion/:id_funcionario
// ═════════════════════════════════════════════════════════════════════════════
const getAcumulacion = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [fRows] = await db.query(
      `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2, f.fecha_ingreso
       FROM funcionarios f
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (!fRows.length) return res.status(404).json({ error: 'Funcionario no encontrado' });

    const f          = fRows[0];
    const antiguedad = calcularAntiguedad(f.fecha_ingreso);
    const anios      = calcularAniosServicio(f.fecha_ingreso);

    const nombramientos = await getNombramientosActivos(id_funcionario);
    const saldosPorNom  = await buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad);

    const totalAcumulados  = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_acumulados,  0) * 100) / 100;
    const totalDisponibles = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_disponibles, 0) * 100) / 100;

    const [historial] = await db.query(
      `SELECT YEAR(fecha_inicio) AS anio, SUM(dias_solicitados) AS dias_disfrutados
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'aprobada' AND tipo_solicitud = 'personal'
       GROUP BY YEAR(fecha_inicio) ORDER BY anio DESC`,
      [id_funcionario]
    );

    const [colectivas] = await db.query(
      `SELECT id_colectiva, descripcion, fecha_inicio, fecha_fin
       FROM vacaciones_colectivas WHERE estado = 'activo' ORDER BY fecha_inicio DESC`
    );

    const primerNom = saldosPorNom[0];

    res.json({
      funcionario: {
        id_funcionario:     f.id_funcionario,
        nombre:             `${f.nombre} ${f.apellido1} ${f.apellido2 || ''}`.trim(),
        fecha_ingreso:      f.fecha_ingreso,
        anios_servicio:     anios,
        antiguedad_anios:   antiguedad,
        tipo_nombramiento:  primerNom?.nombre_tipo || 'No asignado',
        es_docente_interino:!!primerNom?.es_docente_interino,
      },
      acumulacion: {
        dias_acumulados_total: totalAcumulados,
        dias_disponibles:      totalDisponibles,
        regla_aplicada:        primerNom?.regla_descripcion || 'Sin nombramiento activo',
        regla_codigo:          primerNom?.regla_codigo      || 'N/A',
      },
      saldos_por_nombramiento: saldosPorNom,
      historial_por_anio:      historial,
      vacaciones_colectivas:   colectivas,
    });
  } catch (err) {
    console.error('getAcumulacion:', err);
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/saldo/disponible/:id_funcionario
// ═════════════════════════════════════════════════════════════════════════════
const getSaldoDisponible = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario,
              CONCAT(f.nombre,' ',f.apellido1,IFNULL(CONCAT(' ',f.apellido2),'')) AS nombre_completo,
              f.fecha_ingreso,
              d.nombre_departamento, c.nombre_cargo,
              pl.nombre_periodo AS periodo_lectivo_activo
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN cargos c ON f.id_cargo = c.id_cargo
       LEFT JOIN periodos_lectivos pl ON f.id_periodo_lectivo_activo = pl.id_periodo_lectivo
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (!rows.length) return res.status(404).json({ error: 'Funcionario no encontrado' });

    const f          = rows[0];
    const antiguedad = calcularAntiguedad(f.fecha_ingreso);
    const anios      = calcularAniosServicio(f.fecha_ingreso);

    const nombramientos   = await getNombramientosActivos(id_funcionario);
    const saldosPorNom    = await buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad);

    const diasAcumulados  = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_acumulados,  0) * 100) / 100;
    const diasDisponibles = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_disponibles, 0) * 100) / 100;

    const [pendientes] = await db.query(
      `SELECT COALESCE(SUM(dias_solicitados), 0) AS dias_pendientes
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'pendiente' AND tipo_solicitud = 'personal'`,
      [id_funcionario]
    );
    const diasPendientes = parseFloat(pendientes[0].dias_pendientes) || 0;
    const saldoLibre     = Math.max(Math.round((diasDisponibles - diasPendientes) * 100) / 100, 0);

    const primerNom = saldosPorNom[0];

    res.json({
      funcionario: {
        id_funcionario:         f.id_funcionario,
        nombre_completo:        f.nombre_completo,
        departamento:           f.nombre_departamento,
        cargo:                  f.nombre_cargo,
        tipo_nombramiento:      primerNom?.nombre_tipo || 'No asignado',
        periodo_lectivo_activo: f.periodo_lectivo_activo || null,
        fecha_ingreso:          f.fecha_ingreso,
        anios_servicio:         anios,
        antiguedad_anios:       antiguedad,
      },
      saldo: {
        dias_acumulados:                diasAcumulados,
        dias_disponibles:               diasDisponibles,
        dias_en_solicitudes_pendientes: diasPendientes,
        saldo_libre:                    saldoLibre,
        porcentaje_usado:               diasAcumulados > 0
          ? Math.round((1 - diasDisponibles / diasAcumulados) * 100)
          : 0,
      },
      alerta_vencimiento: diasDisponibles < 5 && diasDisponibles > 0,
      fecha_consulta:     new Date().toISOString().split('T')[0],
      saldos_por_nombramiento: saldosPorNom,
    });
  } catch (err) {
    console.error('getSaldoDisponible:', err);
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/saldo/descuentos/:id_funcionario
// ═════════════════════════════════════════════════════════════════════════════
const getDescuentos = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [fRows] = await db.query(
      `SELECT id_funcionario, nombre, apellido1, apellido2, fecha_ingreso
       FROM funcionarios WHERE id_funcionario = ? AND estado = 'activo'`,
      [id_funcionario]
    );
    if (!fRows.length) return res.status(404).json({ error: 'Funcionario no encontrado' });

    const f          = fRows[0];
    const antiguedad = calcularAntiguedad(f.fecha_ingreso);

    const nombramientos = await getNombramientosActivos(id_funcionario);
    const saldosPorNom  = await buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad);
    const diasAcumulados = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_acumulados,  0) * 100) / 100;
    const saldoActual    = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_disponibles, 0) * 100) / 100;

    const [descuentos] = await db.query(
      `SELECT sv.id_solicitud, sv.numero_solicitud,
              sv.fecha_inicio, sv.fecha_fin, sv.dias_solicitados,
              sv.saldo_antes, sv.saldo_despues,
              sv.fecha_aprobacion, sv.estado, sv.tipo_solicitud,
              tn.nombre_tipo
       FROM solicitudes_vacaciones sv
       JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
       JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
       WHERE sv.id_funcionario = ? AND sv.estado = 'aprobada'
       ORDER BY sv.fecha_aprobacion DESC`,
      [id_funcionario]
    );

    const personalDesc  = descuentos.filter(d => d.tipo_solicitud !== 'colectiva');
    const colectivaDesc = descuentos.filter(d => d.tipo_solicitud === 'colectiva');

    res.json({
      funcionario: {
        id_funcionario: f.id_funcionario,
        nombre:         `${f.nombre} ${f.apellido1} ${f.apellido2 || ''}`.trim(),
        dias_acumulados:diasAcumulados,
        saldo_actual:   saldoActual,
      },
      resumen_descuentos: {
        total_dias_personales:   personalDesc.reduce((a, d) => a + parseFloat(d.dias_solicitados || 0), 0),
        total_dias_colectivos:   colectivaDesc.reduce((a, d) => a + parseFloat(d.dias_solicitados || 0), 0),
        cantidad_solicitudes:    personalDesc.length,
        ultimo_descuento:        descuentos[0]?.fecha_aprobacion || null,
      },
      historial_descuentos: descuentos,
    });
  } catch (err) {
    console.error('getDescuentos:', err);
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/saldo/historial-departamento
// ═════════════════════════════════════════════════════════════════════════════
const getHistorialDepartamento = async (req, res) => {
  const { id_departamento, estado, desde, hasta, tipo_solicitud, busqueda, id_tipo_nombramiento } = req.query;
  
  // Obtener rol del usuario desde el token/sesión
  // Por ahora lo recibimos como query param hasta integrar auth middleware
  const { id_funcionario_solicitante } = req.query;

  try {
    // Validar fechas V4
    if (desde && hasta && new Date(desde) > new Date(hasta)) {
      return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin.', codigo: 'MSG-HVD-ERR-003' });
    }

    const condiciones = ['sv.id_solicitud IS NOT NULL'];
    const params = [];

    if (id_departamento) { condiciones.push('f.id_departamento = ?'); params.push(id_departamento); }
    if (estado)          { condiciones.push('sv.estado = ?');          params.push(estado); }
    if (desde)           { condiciones.push('sv.fecha_inicio >= ?');   params.push(desde); }
    if (hasta)           { condiciones.push('sv.fecha_fin <= ?');      params.push(hasta); }
    if (tipo_solicitud)  { condiciones.push('sv.tipo_solicitud = ?');  params.push(tipo_solicitud); }
    if (id_tipo_nombramiento) { condiciones.push('tn.id_tipo_nombramiento = ?'); params.push(id_tipo_nombramiento); }
    if (busqueda) {
     condiciones.push("(CONCAT(f.nombre,' ',f.apellido1) LIKE ? OR f.cedula LIKE ?)");
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }

    const [rows] = await db.query(
      `SELECT sv.id_solicitud, sv.numero_solicitud,
              CONCAT(f.nombre,' ',f.apellido1,IFNULL(CONCAT(' ',f.apellido2),'')) AS funcionario,
              f.cedula, d.nombre_departamento,
              tn.nombre_tipo AS tipo_nombramiento,
              tn.id_tipo_nombramiento,
              sv.fecha_inicio, sv.fecha_fin, sv.dias_solicitados,
              sv.estado, sv.tipo_solicitud,
              sv.fecha_aprobacion,
              sv.motivo,
              sv.comentarios_aprobador,
              CONCAT(ap.nombre,' ',ap.apellido1) AS aprobador
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN funcionarios_nombramientos fn ON sv.id_nombramiento = fn.id_nombramiento
       LEFT JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN funcionarios ap ON sv.id_aprobador = ap.id_funcionario
       WHERE ${condiciones.join(' AND ')}
       ORDER BY sv.fecha_creacion DESC`,
      params
    );

    if (!rows.length) {
      const msg = (desde || hasta || estado || busqueda || id_tipo_nombramiento)
        ? { mensaje: 'No se encontraron solicitudes con los criterios seleccionados.', codigo: 'MSG-HVD-INFO-002' }
        : { mensaje: 'No hay funcionarios que hayan realizado solicitudes en los departamentos disponibles.', codigo: 'MSG-HVD-INFO-001' };
      return res.json({ historial: [], total: 0, ...msg });
    }

    res.json({ historial: rows, total: rows.length });
  } catch (err) {
    console.error('getHistorialDepartamento:', err);
    res.status(500).json({ error: 'No se pudo cargar el historial.', codigo: 'MSG-HVD-ERR-008' });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// VACACIONES COLECTIVAS
// ═════════════════════════════════════════════════════════════════════════════
const getColectivas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_colectiva, descripcion, fecha_inicio, fecha_fin, estado, fecha_creacion
       FROM vacaciones_colectivas ORDER BY fecha_inicio DESC`
    );
    res.json({ colectivas: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const crearColectiva = async (req, res) => {
  const { descripcion, fecha_inicio, fecha_fin } = req.body;
  if (!descripcion || !fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'descripcion, fecha_inicio y fecha_fin son requeridos' });
  if (new Date(fecha_inicio) >= new Date(fecha_fin))
    return res.status(400).json({ error: 'fecha_inicio debe ser anterior a fecha_fin' });
  try {
    const [result] = await db.query(
      `INSERT INTO vacaciones_colectivas (descripcion, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, 'activo')`,
      [descripcion, fecha_inicio, fecha_fin]
    );
    res.status(201).json({ mensaje: 'Período colectivo creado', id_colectiva: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const actualizarColectiva = async (req, res) => {
  const { id } = req.params;
  const { descripcion, fecha_inicio, fecha_fin, estado } = req.body;
  if (fecha_inicio && fecha_fin && new Date(fecha_fin) < new Date(fecha_inicio))
    return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio' });
  try {
    const [result] = await db.query(
      `UPDATE vacaciones_colectivas
       SET descripcion  = COALESCE(?, descripcion),
           fecha_inicio = COALESCE(?, fecha_inicio),
           fecha_fin    = COALESCE(?, fecha_fin),
           estado       = COALESCE(?, estado)
       WHERE id_colectiva = ?`,
      [descripcion, fecha_inicio, fecha_fin, estado, id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Período colectivo actualizado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const eliminarColectiva = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE vacaciones_colectivas SET estado = 'inactivo' WHERE id_colectiva = ?`, [id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Período colectivo desactivado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═════════════════════════════════════════════════════════════════════════════
// SIMULACIÓN DE LIQUIDACIÓN  (PA-GIRH-10 §5.2)
// ═════════════════════════════════════════════════════════════════════════════
const getSimulacionLiquidacion = async (req, res) => {
  const { id_funcionario }  = req.params;
  const salarioOverride     = req.query.salario_mensual ? parseFloat(req.query.salario_mensual) : null;
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario,
              CONCAT(f.nombre,' ',f.apellido1,IFNULL(CONCAT(' ',f.apellido2),'')) AS nombre_completo,
              f.fecha_ingreso, f.fecha_fin_nombramiento,
              pl.nombre_periodo AS periodo_lectivo, pl.fecha_fin AS fin_periodo
       FROM funcionarios f
       LEFT JOIN periodos_lectivos pl ON f.id_periodo_lectivo_activo = pl.id_periodo_lectivo
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (!rows.length) return res.status(404).json({ error: 'Funcionario no encontrado' });

    const f          = rows[0];
    const antiguedad = calcularAntiguedad(f.fecha_ingreso);
    const anios      = calcularAniosServicio(f.fecha_ingreso);

    const nombramientos   = await getNombramientosActivos(id_funcionario);
    const saldosPorNom    = await buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad);
    const diasDisponibles = Math.round(saldosPorNom.reduce((s, n) => s + n.dias_disponibles, 0) * 100) / 100;

    const primerNom = saldosPorNom[0];

    const salarioMensual    = salarioOverride || 0;
    const salarioDiario     = salarioMensual / 30;
    const pagoPorVacaciones = diasDisponibles * salarioDiario;
    const aniosCesantia     = Math.min(anios, 8);
    const pagoCesantia      = aniosCesantia * salarioMensual;
    const mesActual         = new Date().getMonth() + 1;
    const aguinaldo         = (salarioMensual / 12) * mesActual;
    const total             = pagoPorVacaciones + pagoCesantia + aguinaldo;

    res.json({
      funcionario: {
        id_funcionario:         f.id_funcionario,
        nombre_completo:        f.nombre_completo,
        tipo_nombramiento:      primerNom?.nombre_tipo || 'No asignado',
        es_docente_interino:    !!primerNom?.es_docente_interino,
        periodo_lectivo:        f.periodo_lectivo || null,
        fecha_fin_nombramiento: f.fecha_fin_nombramiento || f.fin_periodo || null,
        anios_servicio:         anios,
        antiguedad_anios:       antiguedad,
      },
      simulacion: {
        dias_vacaciones_pendientes: diasDisponibles,
        salario_mensual_ingresado:  salarioMensual,
        salario_diario:             parseFloat(salarioDiario.toFixed(2)),
        desglose: {
          pago_vacaciones_pendientes: parseFloat(pagoPorVacaciones.toFixed(2)),
          cesantia:                   parseFloat(pagoCesantia.toFixed(2)),
          aguinaldo_proporcional:     parseFloat(aguinaldo.toFixed(2)),
        },
        total_liquidacion: parseFloat(total.toFixed(2)),
        moneda:    'CRC',
        nota:      salarioMensual > 0
          ? 'Estimación sin deducciones de cargas sociales. El monto real requiere formulario FA-GIRH-02 ante el GIRH.'
          : 'Ingrese ?salario_mensual=XXXXX para calcular montos.',
        base_legal:'PA-GIRH-10 §5.2',
      },
    });
  } catch (err) {
    console.error('getSimulacionLiquidacion:', err);
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// LEGACY (compatibilidad con rutas anteriores)
// ═════════════════════════════════════════════════════════════════════════════
const obtenerSaldoPropio = async (req, res) => {
  const { id_funcionario } = req.query;
  if (!id_funcionario) return res.status(400).json({ error: 'Se requiere id_funcionario' });
  try {
    const [funcs] = await db.query(
      `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2,
              f.fecha_ingreso, d.nombre_departamento AS departamento
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       WHERE f.id_funcionario = ? AND f.estado = 'activo' LIMIT 1`,
      [id_funcionario]
    );
    if (!funcs.length) return res.status(404).json({ error: 'Funcionario no encontrado' });

    const func       = funcs[0];
    const antiguedad = calcularAntiguedad(func.fecha_ingreso);
    const anios      = calcularAniosServicio(func.fecha_ingreso);

    const nombramientos = await getNombramientosActivos(id_funcionario);
    const saldosPorNom  = await buildSaldosPorNombramiento(nombramientos, id_funcionario, antiguedad);

    const primerNom = saldosPorNom[0];

    res.json({
      funcionario:       `${func.nombre} ${func.apellido1} ${func.apellido2 ?? ''}`.trim(),
      departamento:      func.departamento,
      tipo_nombramiento: primerNom?.nombre_tipo || 'No asignado',
      fecha_ingreso:     func.fecha_ingreso,
      anios_servicio:    anios,
      dias_acumulados:   Math.round(saldosPorNom.reduce((s, n) => s + n.dias_acumulados,  0) * 100) / 100,
      dias_usados:       Math.round(saldosPorNom.reduce((s, n) => s + n.dias_usados,      0) * 100) / 100,
      dias_disponibles:  Math.round(saldosPorNom.reduce((s, n) => s + n.dias_disponibles, 0) * 100) / 100,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const historialPorDepartamento = async (req, res) => {
  const { id_departamento } = req.query;
  if (!id_departamento) return res.status(400).json({ error: 'Se requiere id_departamento' });
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario,
              CONCAT(f.nombre,' ',f.apellido1,IFNULL(CONCAT(' ',f.apellido2),'')) AS nombre_completo,
              f.fecha_ingreso,
              d.nombre_departamento AS departamento,
              tn.nombre_tipo AS tipo_nombramiento,
              sv.estado, sv.tipo_solicitud, sv.fecha_inicio, sv.fecha_fin,
              sv.dias_solicitados, sv.numero_solicitud
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN funcionarios_nombramientos fn
         ON fn.id_funcionario = f.id_funcionario AND fn.es_activo = 1
       LEFT JOIN tipos_nombramiento tn ON fn.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN solicitudes_vacaciones sv ON f.id_funcionario = sv.id_funcionario
       WHERE f.id_departamento = ?
       ORDER BY f.apellido1, f.nombre, sv.fecha_inicio DESC`,
      [id_departamento]
    );
    res.json(rows.map(r => ({
      ...r,
      anios_servicio:   calcularAniosServicio(r.fecha_ingreso),
      antiguedad_anios: calcularAntiguedad(r.fecha_ingreso),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const listarColectivas    = getColectivas;
const desactivarColectiva = eliminarColectiva;

const simularLiquidacion = async (req, res) => {
  const { id_funcionario } = req.query;
  if (!id_funcionario) return res.status(400).json({ error: 'Se requiere id_funcionario' });
  req.params = { id_funcionario };
  return getSimulacionLiquidacion(req, res);
};

// ═════════════════════════════════════════════════════════════════════════════
module.exports = {
  obtenerSaldoPropio,
  historialPorDepartamento,
  listarColectivas,
  crearColectiva,
  actualizarColectiva,
  eliminarColectiva,
  desactivarColectiva,
  simularLiquidacion,
  getAcumulacion,
  getCalculoSaldo,
  getDescuentos,
  getColectivas,
  getHistorialDepartamento,
  getSaldoDisponible,
  getSimulacionLiquidacion,
};