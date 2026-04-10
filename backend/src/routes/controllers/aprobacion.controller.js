const db = require("./db");

function validarAcceso(req, res) {
  // Ahora lo leemos de req.query en vez de req.headers
  const rol = req.query.rol;

  if (!rol || !['jefe', 'rrhh'].includes(rol)) {
    res.status(403).json({
      error: 'No tiene permisos para acceder a este módulo.',
      codigo: 'MSG-RV-ERR-001'
    });
    return false;
  }
  return true;
}

function validarJefatura(req, res) {
  // Ahora lo leemos de req.query
  const rol = req.query.rol;

  if (rol !== 'jefe') {
    res.status(403).json({
      error: 'Solo jefatura puede aprobar o rechazar solicitudes.',
      codigo: 'MSG-AE-ERR-001'
    });
    return false;
  }
  return true;
}

// ─── GET /api/aprobacion/todas ───────────────────────────────
// 🔹 Trae TODAS las solicitudes (con departamento opcional)
const todasLasSolicitudes = async (req, res) => {
  if (!validarAcceso(req, res)) return;

  const { id_departamento } = req.query;

  try {
    let query = `
      SELECT 
        sv.id_solicitud,
        sv.numero_solicitud,
        CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS funcionario,
        sv.id_funcionario,
        sv.id_nombramiento,
        sv.fecha_inicio,
        sv.fecha_fin,
        sv.dias_solicitados,
        sv.estado,
        sv.tipo_solicitud,
        sv.modalidad,
        sv.motivo AS observaciones,
        sv.fecha_creacion AS fecha_solicitud,
        d.nombre_departamento AS departamento
      FROM solicitudes_vacaciones sv
      JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
      LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
      WHERE 1=1
    `;

    const params = [];

    // 🔹 OPCIONAL (NO obligatorio)
    if (id_departamento) {
      query += ` AND f.id_departamento = ?`;
      params.push(id_departamento);
    }

    query += ` ORDER BY sv.fecha_creacion DESC`;

    const [rows] = await db.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error("todasLasSolicitudes:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─── GET /api/aprobacion/:id ───────────────────────────────
// 🔹 Trae UNA solicitud (detalle)
const verSolicitud = async (req, res) => {
  if (!validarAcceso(req, res)) return;

  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT 
         sv.*,
         CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS funcionario,
         d.nombre_departamento AS departamento
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
       WHERE sv.id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    return res.json(rows[0]);

  } catch (err) {
    console.error("verSolicitud:", err);
    return res.status(500).json({ error: err.message });
  }
};


// ─── SOLO SI QUIERES VER SOLO PENDIENTES ─────────
const listarPendientes = async (req, res) => {
  if (!validarAcceso(req, res)) return;

  try {
    const [rows] = await db.query(
      `SELECT 
        sv.id_solicitud,
        sv.numero_solicitud,
        CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS funcionario,
        sv.fecha_inicio,
        sv.fecha_fin,
        sv.dias_solicitados,
        sv.estado
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       WHERE sv.estado = 'pendiente'
       ORDER BY sv.fecha_creacion ASC`
    );

    return res.json(rows);

  } catch (err) {
    console.error("listarPendientes:", err);
    res.status(500).json({ error: err.message });
  }
};

// Gime para lo de jefatura es que solo jefatura puede aprobar o rechazar entonces ésto de abajo te sirve:::
// if (!validarJefatura(req, res)) return;

module.exports = {
  todasLasSolicitudes,
  verSolicitud,
  listarPendientes
};