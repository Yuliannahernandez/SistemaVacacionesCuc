const db = require("./db");
const nodemailer = require("nodemailer");

// Configurar el transportador de correo
const transporter = nodemailer.createTransport({
  service:"gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass:process.env.MAIL_PASS
  }
});

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

// ─── PUT /api/aprobacion/aprobar/:id ───────────────────────────────
const aprobarSolicitud = async (req, res) => {
  if (!validarJefatura(req, res)) return;

  const { id } = req.params;
  const { id_aprobador, comentario } = req.body;

  try {
    if (!id_aprobador) {
      return res.status(400).json({
        error: "El id_aprobador es obligatorio.",
        codigo: "MSG-AE-ERR-002"
      });
    }

    const [rows] = await db.query(
      `SELECT 
         sv.id_solicitud,
         sv.numero_solicitud,
         f.email,
         CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS funcionario
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       WHERE sv.id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Solicitud no encontrada.",
        codigo: "MSG-AE-ERR-003"
      });
    }

    await db.query("CALL sp_aprobar_solicitud(?, ?, ?)", [
      id,
      id_aprobador,
      comentario || null
    ]);

    try {
      if (rows[0].email) {
        const asunto = `Solicitud de vacaciones aprobada #${rows[0].numero_solicitud}`;
        const texto =
          `Hola ${rows[0].funcionario},\n\n` +
          `Tu solicitud de vacaciones #${rows[0].numero_solicitud} fue aprobada.\n` +
          `Puedes ingresar al sistema para revisar el detalle.\n\n` +
          `SIGEVAC`;

        await transporter.sendMail({
          from: process.env.MAIL_FROM || process.env.MAIL_USER,
          to: rows[0].email,
          subject: asunto,
          text: texto
        });
      }
    } catch (mailErr) {
      console.error("Error al enviar correo de aprobación:", mailErr);
    }

    return res.json({
      mensaje: "Solicitud aprobada correctamente.",
      codigo: "MSG-AE-OK-001"
    });

  } catch (err) {
    console.error("aprobarSolicitud:", err);
    return res.status(500).json({
      error: err.message,
      codigo: "MSG-AE-ERR-004"
    });
  }
};

// ─── PUT /api/aprobacion/rechazar/:id ───────────────────────────────
const rechazarSolicitud = async (req, res) => {
  if (!validarJefatura(req, res)) return;

  const { id } = req.params;
  const { id_aprobador, motivo_rechazo } = req.body;

  try {
    if (!id_aprobador) {
      return res.status(400).json({
        error: "El id_aprobador es obligatorio.",
        codigo: "MSG-AE-ERR-002"
      });
    }

    if (!motivo_rechazo || !motivo_rechazo.trim()) {
      return res.status(400).json({
        error: "El motivo de rechazo es obligatorio.",
        codigo: "MSG-AE-ERR-005"
      });
    }

    const [rows] = await db.query(
      `SELECT 
         sv.id_solicitud,
         sv.numero_solicitud,
         f.email,
         CONCAT(f.nombre, ' ', f.apellido1, IFNULL(CONCAT(' ', f.apellido2), '')) AS funcionario
       FROM solicitudes_vacaciones sv
       JOIN funcionarios f ON sv.id_funcionario = f.id_funcionario
       WHERE sv.id_solicitud = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Solicitud no encontrada.",
        codigo: "MSG-AE-ERR-003"
      });
    }

    await db.query("CALL sp_rechazar_solicitud(?, ?, ?)", [
      id,
      id_aprobador,
      motivo_rechazo.trim()
    ]);

    try {
      if (rows[0].email) {
        const asunto = `Solicitud de vacaciones rechazada #${rows[0].numero_solicitud}`;
        const texto =
          `Hola ${rows[0].funcionario},\n\n` +
          `Tu solicitud de vacaciones #${rows[0].numero_solicitud} fue rechazada.\n` +
          `Motivo: ${motivo_rechazo.trim()}\n` +
          `Puedes ingresar al sistema para revisar el detalle.\n\n` +
          `SIGEVAC`;

        await transporter.sendMail({
          from: process.env.MAIL_FROM || process.env.MAIL_USER,
          to: rows[0].email,
          subject: asunto,
          text: texto
        });
      }
    } catch (mailErr) {
      console.error("Error al enviar correo de rechazo:", mailErr);
    }

    return res.json({
      mensaje: "Solicitud rechazada correctamente.",
      codigo: "MSG-AE-OK-002"
    });

  } catch (err) {
    console.error("rechazarSolicitud:", err);
    return res.status(500).json({
      error: err.message,
      codigo: "MSG-AE-ERR-006"
    });
  }
};

module.exports = {
  todasLasSolicitudes,
  verSolicitud,
  listarPendientes,
  aprobarSolicitud,
  rechazarSolicitud
};
