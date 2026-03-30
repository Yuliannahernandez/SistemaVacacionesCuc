const db = require("./db");

// ─── GET /api/aprobacion/pendientes?id_departamento=X ───────────────────────
const listarPendientes = async (req, res) => {
  const { id_departamento } = req.query;

  if (!id_departamento) {
    return res.status(400).json({ error: "Se requiere id_departamento" });
  }

  try {
    const [rows] = await db.query(
      `SELECT sv.id_solicitud,
              sv.numero_solicitud,
              CONCAT(f.nombre,' ',f.apellido1, IFNULL(CONCAT(' ',f.apellido2),'')) AS funcionario,
              f.id_funcionario,
              sv.fecha_inicio, sv.fecha_fin,
              sv.dias_solicitados, sv.estado,
              sv.motivo AS observaciones,
              sv.fecha_creacion AS fecha_solicitud,
              d.nombre_departamento AS departamento
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       WHERE f.id_departamento = ? AND sv.estado = 'pendiente'
       ORDER BY sv.fecha_creacion ASC`,
      [id_departamento]
    );

    return res.json(rows);
  } catch (err) {
    console.error("listarPendientes:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/aprobacion/aprobar/:id   body: { comentario } ─────────────────
const aprobarSolicitud = async (req, res) => {
  const { id } = req.params;
  const { comentario, id_aprobador } = req.body;

  // id_aprobador es el funcionario (jefe/rrhh) que aprueba
  if (!id_aprobador) {
    return res.status(400).json({ error: "Se requiere id_aprobador en el body" });
  }

  try {
    const [rows] = await db.query(
      `SELECT sv.id_solicitud, sv.estado, sv.dias_solicitados,
              sv.id_funcionario,
              f.dias_vacaciones_disponibles,
              f.fecha_ingreso
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       WHERE sv.id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const solicitud = rows[0];

    if (solicitud.estado !== "pendiente") {
      return res.status(409).json({ error: "Solo se pueden aprobar solicitudes pendientes" });
    }

    const disponibles = Number(solicitud.dias_vacaciones_disponibles);

    if (Number(solicitud.dias_solicitados) > disponibles) {
      return res.status(409).json({
        error: `Saldo insuficiente. Disponibles: ${disponibles}, requeridos: ${solicitud.dias_solicitados}`,
      });
    }

    // Calcular saldo nuevo
    const saldoDespues = disponibles - Number(solicitud.dias_solicitados);

    // Aprobar y actualizar saldo del funcionario en una transacción
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE solicitudes_vacaciones
         SET estado = 'aprobada',
             comentarios_aprobador = ?,
             id_aprobador = ?,
             fecha_aprobacion = NOW(),
             saldo_antes = ?,
             saldo_despues = ?
         WHERE id_solicitud = ?`,
        [comentario || null, id_aprobador, disponibles, saldoDespues, id]
      );

      // Descontar días del saldo del funcionario
      await conn.query(
        `UPDATE funcionarios
         SET dias_vacaciones_disponibles = dias_vacaciones_disponibles - ?
         WHERE id_funcionario = ?`,
        [solicitud.dias_solicitados, solicitud.id_funcionario]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    return res.json({
      mensaje: "Solicitud aprobada. Días descontados del saldo.",
      dias_descontados: solicitud.dias_solicitados,
      saldo_restante: saldoDespues,
    });
  } catch (err) {
    console.error("aprobarSolicitud:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/aprobacion/rechazar/:id   body: { motivo_rechazo, id_aprobador } ─
const rechazarSolicitud = async (req, res) => {
  const { id } = req.params;
  const { motivo_rechazo, id_aprobador } = req.body;

  if (!motivo_rechazo) {
    return res.status(400).json({ error: "Se requiere motivo_rechazo" });
  }
  if (!id_aprobador) {
    return res.status(400).json({ error: "Se requiere id_aprobador" });
  }

  try {
    const [rows] = await db.query(
      `SELECT estado FROM solicitudes_vacaciones WHERE id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (rows[0].estado !== "pendiente") {
      return res.status(409).json({ error: "Solo se pueden rechazar solicitudes pendientes" });
    }

    // El motivo_rechazo se guarda en comentarios_aprobador (no hay columna separada en la BD)
    await db.query(
      `UPDATE solicitudes_vacaciones
       SET estado = 'rechazada',
           comentarios_aprobador = ?,
           id_aprobador = ?,
           fecha_aprobacion = NOW()
       WHERE id_solicitud = ?`,
      [motivo_rechazo, id_aprobador, id]
    );

    return res.json({ mensaje: "Solicitud rechazada" });
  } catch (err) {
    console.error("rechazarSolicitud:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/aprobacion/todas?id_departamento=X&estado=X ───────────────────
const todasLasSolicitudes = async (req, res) => {
  const { id_departamento, estado } = req.query;

  if (!id_departamento) {
    return res.status(400).json({ error: "Se requiere id_departamento" });
  }

  try {
    let query = `
      SELECT sv.id_solicitud,
             sv.numero_solicitud,
             CONCAT(f.nombre,' ',f.apellido1, IFNULL(CONCAT(' ',f.apellido2),'')) AS funcionario,
             sv.fecha_inicio, sv.fecha_fin,
             sv.dias_solicitados, sv.estado,
             sv.motivo AS observaciones,
             sv.comentarios_aprobador,
             sv.fecha_creacion AS fecha_solicitud,
             sv.fecha_aprobacion AS fecha_resolucion,
             sv.saldo_antes,
             sv.saldo_despues
      FROM solicitudes_vacaciones sv
      JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
      WHERE f.id_departamento = ?`;

    const params = [id_departamento];

    if (estado) {
      query += ` AND sv.estado = ?`;
      params.push(estado);
    }

    query += ` ORDER BY sv.fecha_creacion DESC`;

    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error("todasLasSolicitudes:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listarPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
  todasLasSolicitudes,
};