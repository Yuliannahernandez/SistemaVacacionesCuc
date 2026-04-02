

const db = require('./db');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function calcularAniosServicio(fechaIngreso) {
  const hoy = new Date();
  const ingreso = new Date(fechaIngreso);
  return Math.floor((hoy - ingreso) / (1000 * 60 * 60 * 24 * 365.25));
}

function calcularAntigüedad(fechaIngreso) {
  const hoy = new Date();
  const ingreso = new Date(fechaIngreso);
  let años = hoy.getFullYear() - ingreso.getFullYear();
  const m = hoy.getMonth() - ingreso.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < ingreso.getDate())) años--;
  return años;
}



// GET /api/saldo/mio?id_funcionario=X
const obtenerSaldoPropio = async (req, res) => {
  const { id_funcionario } = req.query;
  if (!id_funcionario) {
    return res.status(400).json({ error: 'Se requiere id_funcionario' });
  }
  try {
    const [funcs] = await db.query(
      `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2,
              f.fecha_ingreso,
              f.dias_vacaciones_acumulados,
              f.dias_vacaciones_disponibles,
              d.nombre_departamento AS departamento,
              tn.nombre_tipo AS tipo_nombramiento,
              tn.dias_vacaciones_anuales
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       WHERE f.id_funcionario = ?
       LIMIT 1`,
      [id_funcionario]
    );
    if (funcs.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado' });
    }
    const func = funcs[0];
    const anios = calcularAniosServicio(func.fecha_ingreso);
    const [usados] = await db.query(
      `SELECT COALESCE(SUM(dias_solicitados), 0) AS total_usados
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'aprobada'`,
      [id_funcionario]
    );
    const diasUsados = Number(usados[0].total_usados);
    const diasAcumulados = Number(func.dias_vacaciones_acumulados);
    const diasDisponibles = Number(func.dias_vacaciones_disponibles);
    return res.json({
      funcionario: `${func.nombre} ${func.apellido1} ${func.apellido2 ?? ''}`.trim(),
      departamento: func.departamento,
      tipo_nombramiento: func.tipo_nombramiento,
      fecha_ingreso: func.fecha_ingreso,
      anios_servicio: anios,
      dias_acumulados: diasAcumulados,
      dias_usados: diasUsados,
      dias_disponibles: diasDisponibles,
    });
  } catch (err) {
    console.error('obtenerSaldoPropio:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/saldo/departamento?id_departamento=X
const historialPorDepartamento = async (req, res) => {
  const { id_departamento } = req.query;
  if (!id_departamento) {
    return res.status(400).json({ error: 'Se requiere id_departamento' });
  }
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario,
              CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS nombre_completo,
              f.fecha_ingreso,
              f.dias_vacaciones_acumulados,
              f.dias_vacaciones_disponibles,
              d.nombre_departamento AS departamento,
              tn.nombre_tipo AS tipo_nombramiento,
              sv.estado,
              sv.fecha_inicio,
              sv.fecha_fin,
              sv.dias_solicitados,
              sv.numero_solicitud
       FROM funcionarios f
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN solicitudes_vacaciones sv ON f.id_funcionario = sv.id_funcionario
       WHERE f.id_departamento = ?
       ORDER BY f.apellido1, f.nombre, sv.fecha_inicio DESC`,
      [id_departamento]
    );
    const resultado = rows.map((r) => ({
      ...r,
      anios_servicio: calcularAniosServicio(r.fecha_ingreso),
      dias_acumulados: Number(r.dias_vacaciones_acumulados),
      dias_disponibles: Number(r.dias_vacaciones_disponibles),
    }));
    return res.json(resultado);
  } catch (err) {
    console.error('historialPorDepartamento:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/saldo/colectivas (versión anterior)
const listarColectivas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_colectiva, descripcion, fecha_inicio, fecha_fin, estado, fecha_creacion
       FROM vacaciones_colectivas
       ORDER BY fecha_inicio DESC`
    );
    return res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/saldo/colectivas/:id (versión anterior)
const desactivarColectiva = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE vacaciones_colectivas SET estado = 'inactivo' WHERE id_colectiva = ?`,
      [id]
    );
    return res.json({ mensaje: 'Período colectivo desactivado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/saldo/liquidacion?id_funcionario=X (versión anterior)
const simularLiquidacion = async (req, res) => {
  const { id_funcionario } = req.query;
  if (!id_funcionario) {
    return res.status(400).json({ error: 'Se requiere id_funcionario' });
  }
  try {
    const [funcs] = await db.query(
      `SELECT f.nombre, f.apellido1, f.apellido2,
              f.fecha_ingreso,
              f.dias_vacaciones_acumulados,
              f.dias_vacaciones_disponibles
       FROM funcionarios f
       WHERE f.id_funcionario = ?
       LIMIT 1`,
      [id_funcionario]
    );
    if (funcs.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado' });
    }
    const func = funcs[0];
    const anios = calcularAniosServicio(func.fecha_ingreso);
    const diasPendientes = Number(func.dias_vacaciones_disponibles);
    const salarioMensual = 0;
    const salarioDiario = salarioMensual / 30;
    const pagoPorVacaciones = diasPendientes * salarioDiario;
    const aniosCesantia = Math.min(anios, 8);
    const pagoCesantia = aniosCesantia * salarioMensual;
    const mesActual = new Date().getMonth() + 1;
    const aguinaldoProporcional = (salarioMensual / 12) * mesActual;
    const totalLiquidacion = pagoPorVacaciones + pagoCesantia + aguinaldoProporcional;
    return res.json({
      funcionario: `${func.nombre} ${func.apellido1} ${func.apellido2 ?? ''}`.trim(),
      fecha_ingreso: func.fecha_ingreso,
      anios_servicio: anios,
      dias_vacaciones_pendientes: diasPendientes,
      nota_salario: 'El campo salario_mensual no existe en la BD actual. Agregarlo a la tabla funcionarios para calcular montos reales.',
      desglose: {
        pago_vacaciones_pendientes: pagoPorVacaciones.toFixed(2),
        cesantia: pagoCesantia.toFixed(2),
        aguinaldo_proporcional: aguinaldoProporcional.toFixed(2),
      },
      total_liquidacion: totalLiquidacion.toFixed(2),
      moneda: 'CRC',
    });
  } catch (err) {
    console.error('simularLiquidacion:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// REQUERIMIENTOS COMPLETOS DE NOELIA
// ─────────────────────────────────────────────────────────────

// 1. GET /api/saldo/acumulacion/:id_funcionario
const getAcumulacion = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [funcionarios] = await db.query(
      `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2,
              f.fecha_ingreso, f.dias_vacaciones_acumulados, f.dias_vacaciones_disponibles,
              tn.nombre_tipo, tn.dias_vacaciones_anuales,
              tn.dias_acumulacion_mensual_tramo1, tn.dias_acumulacion_mensual_tramo2,
              tn.es_docente_interino
       FROM funcionarios f
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (funcionarios.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado o inactivo' });
    }
    const f = funcionarios[0];
    const antiguedad = calcularAntigüedad(f.fecha_ingreso);
    const anios = calcularAniosServicio(f.fecha_ingreso);
    const [historial] = await db.query(
      `SELECT YEAR(fecha_inicio) AS anio,
              SUM(dias_solicitados) AS dias_disfrutados
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'aprobada'
       GROUP BY YEAR(fecha_inicio)
       ORDER BY anio DESC`,
      [id_funcionario]
    );
    const [colectivas] = await db.query(
      `SELECT id_colectiva, descripcion, fecha_inicio, fecha_fin
       FROM vacaciones_colectivas
       WHERE estado = 'activo'
       ORDER BY fecha_inicio DESC`
    );
    res.json({
      funcionario: {
        id_funcionario: f.id_funcionario,
        nombre: `${f.nombre} ${f.apellido1} ${f.apellido2 || ''}`.trim(),
        fecha_ingreso: f.fecha_ingreso,
        anios_servicio: anios,
        antiguedad_anios: antiguedad,
        tipo_nombramiento: f.nombre_tipo || 'No asignado',
        es_docente_interino: !!f.es_docente_interino,
      },
      acumulacion: {
        dias_anuales_segun_regla: parseFloat(f.dias_vacaciones_anuales) || 0,
        dias_acumulados_total: parseFloat(f.dias_vacaciones_acumulados) || 0,
        dias_disponibles: parseFloat(f.dias_vacaciones_disponibles) || 0,
        regla_aplicada: antiguedad < 6
          ? 'PA-GIRH-10: 1–5 años de antigüedad'
          : 'PA-GIRH-10: 6+ años de antigüedad',
      },
      historial_por_anio: historial,
      vacaciones_colectivas: colectivas,
    });
  } catch (err) {
    console.error('Error getAcumulacion:', err);
    res.status(500).json({ error: err.message });
  }
};

// 2. GET /api/saldo/calculo/:id_funcionario
const getCalculoSaldo = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2,
              f.fecha_ingreso, f.dias_vacaciones_acumulados, f.dias_vacaciones_disponibles,
              tn.nombre_tipo, tn.es_docente_interino,
              d.nombre_departamento
       FROM funcionarios f
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado' });
    }
    const f = rows[0];
    const antiguedad = calcularAntigüedad(f.fecha_ingreso);
    const anios = calcularAniosServicio(f.fecha_ingreso);
    const [disfrutados] = await db.query(
      `SELECT COALESCE(SUM(dias_solicitados), 0) AS total_disfrutados
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'aprobada'`,
      [id_funcionario]
    );
    const diasAcumulados = parseFloat(f.dias_vacaciones_acumulados) || 0;
    const diasDisfrutados = parseFloat(disfrutados[0].total_disfrutados) || 0;
    const diasDisponibles = parseFloat(f.dias_vacaciones_disponibles) || 0;
    res.json({
      funcionario: {
        id_funcionario: f.id_funcionario,
        nombre: `${f.nombre} ${f.apellido1} ${f.apellido2 || ''}`.trim(),
        departamento: f.nombre_departamento,
        tipo_nombramiento: f.nombre_tipo || 'No asignado',
        fecha_ingreso: f.fecha_ingreso,
        anios_servicio: anios,
        antiguedad_anios: antiguedad,
      },
      calculo_saldo: {
        dias_acumulados: diasAcumulados,
        dias_disfrutados: diasDisfrutados,
        dias_disponibles: diasDisponibles,
        saldo_calculado_en_tiempo_real: Math.max(diasAcumulados - diasDisfrutados, 0),
        regla: antiguedad < 6 ? 'PA-GIRH-10 Tramo 1–5 años' : 'PA-GIRH-10 Tramo 6+ años',
        fecha_calculo: new Date().toISOString().split('T')[0],
      },
    });
  } catch (err) {
    console.error('Error getCalculoSaldo:', err);
    res.status(500).json({ error: err.message });
  }
};

// 3. GET/POST/PUT/DELETE /api/saldo/colectivas
const getColectivas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_colectiva, descripcion, fecha_inicio, fecha_fin, estado, fecha_creacion
       FROM vacaciones_colectivas
       ORDER BY fecha_inicio DESC`
    );
    res.json({ colectivas: rows });
  } catch (err) {
    console.error('Error getColectivas:', err);
    res.status(500).json({ error: err.message });
  }
};

const crearColectiva = async (req, res) => {
  const { descripcion, fecha_inicio, fecha_fin } = req.body;
  if (!descripcion || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'descripcion, fecha_inicio y fecha_fin son requeridos' });
  }
  if (new Date(fecha_inicio) >= new Date(fecha_fin)) {
    return res.status(400).json({ error: 'fecha_inicio debe ser anterior a fecha_fin' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO vacaciones_colectivas (descripcion, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, 'activo')`,
      [descripcion, fecha_inicio, fecha_fin]
    );
    res.status(201).json({ mensaje: 'Período colectivo creado', id_colectiva: result.insertId });
  } catch (err) {
    console.error('Error crearColectiva:', err);
    res.status(500).json({ error: err.message });
  }
};

const actualizarColectiva = async (req, res) => {
  const { id } = req.params;
  const { descripcion, fecha_inicio, fecha_fin, estado } = req.body;
  if (fecha_inicio && fecha_fin && new Date(fecha_fin) < new Date(fecha_inicio)) {
    return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio' });
  }
  try {
    const [result] = await db.query(
      `UPDATE vacaciones_colectivas
       SET descripcion = COALESCE(?, descripcion),
           fecha_inicio = COALESCE(?, fecha_inicio),
           fecha_fin    = COALESCE(?, fecha_fin),
           estado       = COALESCE(?, estado)
       WHERE id_colectiva = ?`,
      [descripcion, fecha_inicio, fecha_fin, estado, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vacación colectiva no encontrada' });
    }
    res.json({ mensaje: 'Período colectivo actualizado' });
  } catch (err) {
    console.error('Error actualizarColectiva:', err);
    res.status(500).json({ error: err.message });
  }
};

const eliminarColectiva = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE vacaciones_colectivas SET estado = 'inactivo' WHERE id_colectiva = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vacación colectiva no encontrada' });
    }
    res.json({ mensaje: 'Período colectivo desactivado' });
  } catch (err) {
    console.error('Error eliminarColectiva:', err);
    res.status(500).json({ error: err.message });
  }
};

// 4. GET /api/saldo/descuentos/:id_funcionario
const getDescuentos = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [fRows] = await db.query(
      `SELECT id_funcionario, nombre, apellido1, apellido2,
              dias_vacaciones_acumulados, dias_vacaciones_disponibles
       FROM funcionarios
       WHERE id_funcionario = ? AND estado = 'activo'`,
      [id_funcionario]
    );
    if (fRows.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado' });
    }
    const [descuentos] = await db.query(
      `SELECT sv.id_solicitud, sv.numero_solicitud,
              sv.fecha_inicio, sv.fecha_fin, sv.dias_solicitados,
              sv.saldo_antes, sv.saldo_despues,
              sv.fecha_aprobacion, sv.estado
       FROM solicitudes_vacaciones sv
       WHERE sv.id_funcionario = ? AND sv.estado = 'aprobada'
       ORDER BY sv.fecha_aprobacion DESC`,
      [id_funcionario]
    );
    const f = fRows[0];
    const totalDescuentos = descuentos.reduce(
      (acc, d) => acc + parseFloat(d.dias_solicitados || 0), 0
    );
    res.json({
      funcionario: {
        id_funcionario: f.id_funcionario,
        nombre: `${f.nombre} ${f.apellido1} ${f.apellido2 || ''}`.trim(),
        dias_acumulados: parseFloat(f.dias_vacaciones_acumulados) || 0,
        saldo_actual: parseFloat(f.dias_vacaciones_disponibles) || 0,
      },
      resumen_descuentos: {
        total_dias_descontados: totalDescuentos,
        cantidad_solicitudes_disfrutadas: descuentos.length,
        ultimo_descuento: descuentos[0] ? descuentos[0].fecha_aprobacion : null,
      },
      historial_descuentos: descuentos,
    });
  } catch (err) {
    console.error('Error getDescuentos:', err);
    res.status(500).json({ error: err.message });
  }
};

// 5. GET /api/saldo/historial-departamento
const getHistorialDepartamento = async (req, res) => {
  const { id_departamento, estado, desde, hasta } = req.query;
  try {
    let condiciones = ['1=1'];
    let params = [];
    if (id_departamento) { condiciones.push('f.id_departamento = ?'); params.push(id_departamento); }
    if (estado) { condiciones.push('sv.estado = ?'); params.push(estado); }
    if (desde) { condiciones.push('sv.fecha_inicio >= ?'); params.push(desde); }
    if (hasta) { condiciones.push('sv.fecha_fin <= ?'); params.push(hasta); }
    const [rows] = await db.query(
      `SELECT sv.id_solicitud, sv.numero_solicitud,
              CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS funcionario,
              f.cedula,
              d.nombre_departamento,
              tn.nombre_tipo AS tipo_nombramiento,
              sv.fecha_inicio, sv.fecha_fin,
              sv.dias_solicitados, sv.estado,
              sv.fecha_aprobacion,
              CONCAT(ap.nombre, ' ', ap.apellido1) AS aprobador
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN funcionarios ap ON sv.id_aprobador = ap.id_funcionario
       WHERE ${condiciones.join(' AND ')}
       ORDER BY sv.fecha_creacion DESC`,
      params
    );
    res.json({ historial: rows, total: rows.length });
  } catch (err) {
    console.error('Error getHistorialDepartamento:', err);
    res.status(500).json({ error: err.message });
  }
};

// 6. GET /api/saldo/disponible/:id_funcionario
const getSaldoDisponible = async (req, res) => {
  const { id_funcionario } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario,
              CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS nombre_completo,
              f.fecha_ingreso,
              f.dias_vacaciones_acumulados,
              f.dias_vacaciones_disponibles,
              tn.nombre_tipo,
              tn.es_docente_interino,
              d.nombre_departamento,
              c.nombre_cargo,
              pl.nombre_periodo AS periodo_lectivo_activo
       FROM funcionarios f
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       LEFT JOIN cargos c ON f.id_cargo = c.id_cargo
       LEFT JOIN periodos_lectivos pl ON f.id_periodo_lectivo_activo = pl.id_periodo_lectivo
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado' });
    }
    const f = rows[0];
    const antiguedad = calcularAntigüedad(f.fecha_ingreso);
    const anios = calcularAniosServicio(f.fecha_ingreso);
    const [pendientes] = await db.query(
      `SELECT COALESCE(SUM(dias_solicitados), 0) AS dias_pendientes
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'pendiente'`,
      [id_funcionario]
    );
    const diasAcumulados = parseFloat(f.dias_vacaciones_acumulados) || 0;
    const diasDisponibles = parseFloat(f.dias_vacaciones_disponibles) || 0;
    const diasPendientes = parseFloat(pendientes[0].dias_pendientes) || 0;
    res.json({
      funcionario: {
        id_funcionario: f.id_funcionario,
        nombre_completo: f.nombre_completo,
        departamento: f.nombre_departamento,
        cargo: f.nombre_cargo,
        tipo_nombramiento: f.nombre_tipo || 'No asignado',
        periodo_lectivo_activo: f.periodo_lectivo_activo || null,
        fecha_ingreso: f.fecha_ingreso,
        anios_servicio: anios,
        antiguedad_anios: antiguedad,
      },
      saldo: {
        dias_acumulados: diasAcumulados,
        dias_disponibles: diasDisponibles,
        dias_en_solicitudes_pendientes: diasPendientes,
        saldo_libre: Math.max(diasDisponibles - diasPendientes, 0),
        porcentaje_usado: diasAcumulados > 0
          ? Math.round((1 - diasDisponibles / diasAcumulados) * 100)
          : 0,
      },
      alerta_vencimiento: diasDisponibles < 5 && diasDisponibles > 0,
      fecha_consulta: new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('Error getSaldoDisponible:', err);
    res.status(500).json({ error: err.message });
  }
};

// 7. GET /api/saldo/simulacion/:id_funcionario
const getSimulacionLiquidacion = async (req, res) => {
  const { id_funcionario } = req.params;
  const salarioOverride = req.query.salario_mensual
    ? parseFloat(req.query.salario_mensual)
    : null;
  try {
    const [rows] = await db.query(
      `SELECT f.id_funcionario,
              CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS nombre_completo,
              f.fecha_ingreso, f.fecha_fin_nombramiento,
              f.dias_vacaciones_disponibles,
              tn.nombre_tipo, tn.es_docente_interino,
              pl.nombre_periodo AS periodo_lectivo,
              pl.fecha_fin AS fin_periodo
       FROM funcionarios f
       LEFT JOIN tipos_nombramiento tn ON f.id_tipo_nombramiento = tn.id_tipo_nombramiento
       LEFT JOIN periodos_lectivos pl ON f.id_periodo_lectivo_activo = pl.id_periodo_lectivo
       WHERE f.id_funcionario = ? AND f.estado = 'activo'`,
      [id_funcionario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado' });
    }
    const f = rows[0];
    const anios = calcularAniosServicio(f.fecha_ingreso);
    const diasDisponibles = parseFloat(f.dias_vacaciones_disponibles) || 0;
    const salarioMensual = salarioOverride || 0;
    const salarioDiario = salarioMensual / 30;
    const pagoPorVacaciones = diasDisponibles * salarioDiario;
    const aniosCesantia = Math.min(anios, 8);
    const pagoCesantia = aniosCesantia * salarioMensual;
    const mesActual = new Date().getMonth() + 1;
    const aguinaldoProporcional = (salarioMensual / 12) * mesActual;
    const totalLiquidacion = pagoPorVacaciones + pagoCesantia + aguinaldoProporcional;
    res.json({
      funcionario: {
        id_funcionario: f.id_funcionario,
        nombre_completo: f.nombre_completo,
        tipo_nombramiento: f.nombre_tipo,
        es_docente_interino: !!f.es_docente_interino,
        periodo_lectivo: f.periodo_lectivo || null,
        fecha_fin_nombramiento: f.fecha_fin_nombramiento || f.fin_periodo || null,
        anios_servicio: anios,
      },
      simulacion: {
        dias_vacaciones_pendientes: diasDisponibles,
        salario_mensual_ingresado: salarioMensual,
        salario_diario: parseFloat(salarioDiario.toFixed(2)),
        desglose: {
          pago_vacaciones_pendientes: parseFloat(pagoPorVacaciones.toFixed(2)),
          cesantia: parseFloat(pagoCesantia.toFixed(2)),
          aguinaldo_proporcional: parseFloat(aguinaldoProporcional.toFixed(2)),
        },
        total_liquidacion: parseFloat(totalLiquidacion.toFixed(2)),
        moneda: 'CRC',
        nota: salarioMensual > 0
          ? 'Estimación sin deducciones de cargas sociales. El monto real requiere formulario FA-GIRH-02 ante el GIRH.'
          : 'Ingrese el parámetro salario_mensual en la URL para obtener montos. Ej: ?salario_mensual=850000',
        base_legal: 'PA-GIRH-10 §5.2',
      },
    });
  } catch (err) {
    console.error('Error getSimulacionLiquidacion:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// EXPORTAR — todas las funciones
// ─────────────────────────────────────────────────────────────
module.exports = {
  // versión anterior conservada
  obtenerSaldoPropio,
  historialPorDepartamento,
  listarColectivas,
  desactivarColectiva,
  simularLiquidacion,
  
  getAcumulacion,
  getCalculoSaldo,
  getColectivas,
  crearColectiva,
  actualizarColectiva,
  eliminarColectiva,
  getDescuentos,
  getHistorialDepartamento,
  getSaldoDisponible,
  getSimulacionLiquidacion,
};