const db = require("./db");


async function verificarConflictoColectiva(fecha_inicio, fecha_fin) {
  const [conflictos] = await db.query(
    `SELECT id_colectiva, descripcion, fecha_inicio, fecha_fin
     FROM vacaciones_colectivas
     WHERE estado = 'activo'
       AND fecha_inicio <= ? AND fecha_fin >= ?`,
    [fecha_fin, fecha_inicio]
  );
  return conflictos;
}

async function diasDisponibles(id_funcionario, fecha_ingreso) {
  const anios =
    (new Date() - new Date(fecha_ingreso)) / (1000 * 60 * 60 * 24 * 365.25);
  let acumulados = 0;
  if (anios >= 10) acumulados = 15;
  else if (anios >= 5) acumulados = 12;
  else if (anios >= 1) acumulados = 10;

  const [usados] = await db.query(
    `SELECT COALESCE(SUM(dias_solicitados), 0) AS total
     FROM solicitudes_vacaciones
     WHERE id_funcionario = ? AND estado = 'aprobada'`,
    [id_funcionario]
  );

  return Math.max(0, acumulados - Number(usados[0].total));
}


const registrarSolicitud = async (req, res) => {
  const { id_funcionario, fecha_inicio, fecha_fin, observaciones } = req.body;

  if (!id_funcionario || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: "Campos requeridos faltantes" });
  }

  const inicio = new Date(fecha_inicio);
  const fin = new Date(fecha_fin);

  if (inicio >= fin) {
    return res
      .status(400)
      .json({ error: "fecha_inicio debe ser anterior a fecha_fin" });
  }

  const diasSolicitados =
    Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;

  try {
    
    const [funcs] = await db.query(
      `SELECT id_funcionario, fecha_ingreso FROM funcionarios WHERE id_funcionario = ?`,
      [id_funcionario]
    );
    if (funcs.length === 0) {
      return res.status(404).json({ error: "Funcionario no encontrado" });
    }

   
    const conflictos = await verificarConflictoColectiva(fecha_inicio, fecha_fin);
    if (conflictos.length > 0) {
      return res.status(409).json({
        error: "El período solicitado choca con una vacación colectiva",
        colectivas: conflictos,
      });
    }

    
    const disponibles = await diasDisponibles(
      id_funcionario,
      funcs[0].fecha_ingreso
    );
    if (diasSolicitados > disponibles) {
      return res.status(409).json({
        error: `Saldo insuficiente. Disponibles: ${disponibles} días, solicitados: ${diasSolicitados}`,
      });
    }

  
    const [traslapadas] = await db.query(
      `SELECT id_solicitud FROM solicitudes_vacaciones
       WHERE id_funcionario = ?
         AND estado NOT IN ('cancelada','rechazada')
         AND fecha_inicio <= ? AND fecha_fin >= ?`,
      [id_funcionario, fecha_fin, fecha_inicio]
    );
    if (traslapadas.length > 0) {
      return res
        .status(409)
        .json({ error: "Ya existe una solicitud que se traslapa con ese período" });
    }

    const [result] = await db.query(
      `INSERT INTO solicitudes_vacaciones
         (id_funcionario, fecha_inicio, fecha_fin, dias_solicitados, estado, observaciones, fecha_solicitud)
       VALUES (?, ?, ?, ?, 'pendiente', ?, NOW())`,
      [id_funcionario, fecha_inicio, fecha_fin, diasSolicitados, observaciones || null]
    );

    return res.status(201).json({
      mensaje: "Solicitud registrada exitosamente",
      id_solicitud: result.insertId,
      dias_solicitados: diasSolicitados,
    });
  } catch (err) {
    console.error("registrarSolicitud:", err);
    res.status(500).json({ error: err.message });
  }
};


const misSolicitudes = async (req, res) => {
  const { id_funcionario } = req.query;

  if (!id_funcionario) {
    return res.status(400).json({ error: "Se requiere id_funcionario" });
  }

  try {
    const [rows] = await db.query(
      `SELECT sv.id_solicitud, sv.fecha_inicio, sv.fecha_fin,
              sv.dias_solicitados, sv.estado, sv.observaciones,
              sv.fecha_solicitud, sv.motivo_rechazo
       FROM solicitudes_vacaciones sv
       WHERE sv.id_funcionario = ?
       ORDER BY sv.fecha_solicitud DESC`,
      [id_funcionario]
    );
    return res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const consultarSolicitud = async (req, res) => {
  const { id_solicitud } = req.query;

  try {
    const [rows] = await db.query(
      `SELECT sv.*, 
              CONCAT(f.nombre,' ',f.apellido1) AS funcionario,
              d.nombre AS departamento
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       WHERE sv.id_solicitud = ?`,
      [id_solicitud]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    return res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const modificarSolicitud = async (req, res) => {
  const { id } = req.params;
  const { fecha_inicio, fecha_fin, observaciones } = req.body;

  try {
    
    const [rows] = await db.query(
      `SELECT sv.id_solicitud, sv.estado, sv.id_funcionario, f.fecha_ingreso
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       WHERE sv.id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (rows[0].estado !== "pendiente") {
      return res
        .status(409)
        .json({ error: "Solo se pueden modificar solicitudes en estado pendiente" });
    }

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    const diasSolicitados =
      Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;

    const conflictos = await verificarConflictoColectiva(fecha_inicio, fecha_fin);
    if (conflictos.length > 0) {
      return res.status(409).json({
        error: "El período choca con una vacación colectiva",
        colectivas: conflictos,
      });
    }

    const disponibles = await diasDisponibles(
      rows[0].id_funcionario,
      rows[0].fecha_ingreso
    );
    if (diasSolicitados > disponibles) {
      return res.status(409).json({
        error: `Saldo insuficiente. Disponibles: ${disponibles}, solicitados: ${diasSolicitados}`,
      });
    }

    await db.query(
      `UPDATE solicitudes_vacaciones
       SET fecha_inicio = ?, fecha_fin = ?, dias_solicitados = ?, observaciones = ?
       WHERE id_solicitud = ?`,
      [fecha_inicio, fecha_fin, diasSolicitados, observaciones || null, id]
    );

    return res.json({ mensaje: "Solicitud actualizada", dias_solicitados: diasSolicitados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const cancelarSolicitud = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT estado FROM solicitudes_vacaciones WHERE id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (!["pendiente", "aprobada"].includes(rows[0].estado)) {
      return res
        .status(409)
        .json({ error: "Solo se pueden cancelar solicitudes pendientes o aprobadas" });
    }

    await db.query(
      `UPDATE solicitudes_vacaciones SET estado = 'cancelada' WHERE id_solicitud = ?`,
      [id]
    );

    return res.json({ mensaje: "Solicitud cancelada exitosamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const historialSolicitudesDepartamento = async (req, res) => {
  const { id_departamento, estado } = req.query;

  if (!id_departamento) {
    return res.status(400).json({ error: "Se requiere id_departamento" });
  }

  try {
    let query = `
      SELECT sv.id_solicitud, sv.fecha_inicio, sv.fecha_fin,
             sv.dias_solicitados, sv.estado, sv.observaciones, sv.fecha_solicitud,
             CONCAT(f.nombre,' ',f.apellido1,' ',f.apellido2) AS funcionario
      FROM solicitudes_vacaciones sv
      JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
      WHERE f.id_departamento = ?`;

    const params = [id_departamento];

    if (estado) {
      query += ` AND sv.estado = ?`;
      params.push(estado);
    }

    query += ` ORDER BY sv.fecha_solicitud DESC`;

    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  registrarSolicitud,
  misSolicitudes,
  consultarSolicitud,
  modificarSolicitud,
  cancelarSolicitud,
  historialSolicitudesDepartamento,
};