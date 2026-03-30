const db = require("./db");


function calcularDiasSegunAntiguedad(fechaIngreso) {
  const hoy = new Date();
  const ingreso = new Date(fechaIngreso);
  const anios = (hoy - ingreso) / (1000 * 60 * 60 * 24 * 365.25);

  if (anios < 1) return 0;
  if (anios < 5) return 10;
  if (anios < 10) return 12;
  return 15;
}

function calcularAniosServicio(fechaIngreso) {
  const hoy = new Date();
  const ingreso = new Date(fechaIngreso);
  return Math.floor((hoy - ingreso) / (1000 * 60 * 60 * 24 * 365.25));
}

// ─── GET /api/saldo/mio?id_funcionario=X ────────────────────────────────────
const obtenerSaldoPropio = async (req, res) => {
  const { id_funcionario } = req.query;

  if (!id_funcionario) {
    return res.status(400).json({ error: "Se requiere id_funcionario" });
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
      return res.status(404).json({ error: "Funcionario no encontrado" });
    }

    const func = funcs[0];
    const anios = calcularAniosServicio(func.fecha_ingreso);

    // Días usados = sum de solicitudes aprobadas
    const [usados] = await db.query(
      `SELECT COALESCE(SUM(dias_solicitados), 0) AS total_usados
       FROM solicitudes_vacaciones
       WHERE id_funcionario = ? AND estado = 'aprobada'`,
      [id_funcionario]
    );

    const diasUsados = Number(usados[0].total_usados);
    // Usamos el saldo guardado en la BD (actualizado por el grupo)
    const diasAcumulados = Number(func.dias_vacaciones_acumulados);
    const diasDisponibles = Number(func.dias_vacaciones_disponibles);

    return res.json({
      funcionario: `${func.nombre} ${func.apellido1} ${func.apellido2 ?? ""}`.trim(),
      departamento: func.departamento,
      tipo_nombramiento: func.tipo_nombramiento,
      fecha_ingreso: func.fecha_ingreso,
      anios_servicio: anios,
      dias_acumulados: diasAcumulados,
      dias_usados: diasUsados,
      dias_disponibles: diasDisponibles,
    });
  } catch (err) {
    console.error("obtenerSaldoPropio:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/saldo/departamento?id_departamento=X ───────────────────────────
const historialPorDepartamento = async (req, res) => {
  const { id_departamento } = req.query;

  if (!id_departamento) {
    return res.status(400).json({ error: "Se requiere id_departamento" });
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
    console.error("historialPorDepartamento:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/saldo/colectivas ───────────────────────────────────────────────
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

// ─── POST /api/saldo/colectivas ──────────────────────────────────────────────
const crearColectiva = async (req, res) => {
  const { descripcion, fecha_inicio, fecha_fin } = req.body;

  if (!descripcion || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: "Todos los campos son requeridos" });
  }

  if (new Date(fecha_inicio) >= new Date(fecha_fin)) {
    return res.status(400).json({ error: "fecha_inicio debe ser anterior a fecha_fin" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO vacaciones_colectivas (descripcion, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, 'activo')`,
      [descripcion, fecha_inicio, fecha_fin]
    );
    return res.status(201).json({ mensaje: "Período colectivo creado", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/saldo/colectivas/:id ────────────────────────────────────────
const desactivarColectiva = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE vacaciones_colectivas SET estado = 'inactivo' WHERE id_colectiva = ?`,
      [id]
    );
    return res.json({ mensaje: "Período colectivo desactivado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/saldo/liquidacion?id_funcionario=X ─────────────────────────────
// NOTA: la BD no tiene salario_mensual en funcionarios.
// Se calcula un estimado basado en días disponibles × un salario ficticio,
// O puedes agregar la columna salario_mensual a funcionarios si tu grupo lo permite.
// Por ahora devuelve el desglose de días y deja los montos como 0 si no hay salario.
const simularLiquidacion = async (req, res) => {
  const { id_funcionario } = req.query;

  if (!id_funcionario) {
    return res.status(400).json({ error: "Se requiere id_funcionario" });
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
      return res.status(404).json({ error: "Funcionario no encontrado" });
    }

    const func = funcs[0];
    const anios = calcularAniosServicio(func.fecha_ingreso);
    const diasPendientes = Number(func.dias_vacaciones_disponibles);

    // Si tu grupo agrega salario_mensual a funcionarios, descomenta y ajusta:
    // const salarioMensual = Number(func.salario_mensual) || 0;
    const salarioMensual = 0; // reemplazar cuando exista el campo
    const salarioDiario = salarioMensual / 30;

    const pagoPorVacaciones = diasPendientes * salarioDiario;

    // Cesantía CR: 1 mes por año, máx. 8
    const aniosCesantia = Math.min(anios, 8);
    const pagoCesantia = aniosCesantia * salarioMensual;

    // Aguinaldo proporcional
    const mesActual = new Date().getMonth() + 1;
    const aguinaldoProporcional = (salarioMensual / 12) * mesActual;

    const totalLiquidacion = pagoPorVacaciones + pagoCesantia + aguinaldoProporcional;

    return res.json({
      funcionario: `${func.nombre} ${func.apellido1} ${func.apellido2 ?? ""}`.trim(),
      fecha_ingreso: func.fecha_ingreso,
      anios_servicio: anios,
      dias_vacaciones_pendientes: diasPendientes,
      nota_salario: "El campo salario_mensual no existe en la BD actual. Agregarlo a la tabla funcionarios para calcular montos reales.",
      desglose: {
        pago_vacaciones_pendientes: pagoPorVacaciones.toFixed(2),
        cesantia: pagoCesantia.toFixed(2),
        aguinaldo_proporcional: aguinaldoProporcional.toFixed(2),
      },
      total_liquidacion: totalLiquidacion.toFixed(2),
      moneda: "CRC",
    });
  } catch (err) {
    console.error("simularLiquidacion:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  obtenerSaldoPropio,
  historialPorDepartamento,
  listarColectivas,
  crearColectiva,
  desactivarColectiva,
  simularLiquidacion,
};