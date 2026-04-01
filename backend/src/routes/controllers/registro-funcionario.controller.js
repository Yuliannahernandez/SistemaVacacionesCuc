// src/routes/controllers/registro.controller.js
'use strict';

const db = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registro/funcionarios
// RQ-SVC-2026-1-Registro de Funcionarios
// ─────────────────────────────────────────────────────────────────────────────
exports.registrarFuncionario = async (req, res) => {
    const {
        cedula, nombre, apellido1, apellido2,
        email, telefono,
        id_departamento, id_cargo, id_tipo_nombramiento, id_supervisor,
        fecha_ingreso, fecha_salida,
        fecha_nombramiento, numero_nombramiento, fecha_fin_nombramiento,
        en_periodo_prueba, fecha_fin_periodo_prueba,
        id_periodo_lectivo_activo,
        dias_vacaciones_acumulados, dias_vacaciones_disponibles,
        estado_contrato,
        usuario, contrasena,
        role,           // el HTML envía "role", la BD usa "rol"
        estado,
        historial_nombramientos
    } = req.body;

    // ── V1: Campos obligatorios ───────────────────────────────────────────────
    const camposObligatorios = {
        cedula, nombre, apellido1, email,
        id_departamento, id_cargo, id_tipo_nombramiento,
        fecha_ingreso, usuario, contrasena
    };
    for (const [campo, valor] of Object.entries(camposObligatorios)) {
        if (valor === undefined || valor === null || String(valor).trim() === '') {
            return res.status(400).json({
                error: 'Por favor complete y/o seleccione todos los campos obligatorios.',
                codigo: 'MSG-REG-ERR-001',
                campo
            });
        }
    }

    // ── V3: Formato cédula ────────────────────────────────────────────────────
    // Nacional: exactamente 9 dígitos numéricos     → MSG-REG-ERR-003
    // Extranjero (pasaporte/DIMEX): 9-12 numéricos  → MSG-REG-ERR-004
    const cedulaLimpia = String(cedula).trim();
    if (!/^\d+$/.test(cedulaLimpia)) {
        return res.status(400).json({
            error: 'La cédula/pasaporte/DIMEX solo debe contener números.',
            codigo: 'MSG-REG-ERR-003'
        });
    }
    if (cedulaLimpia.length < 9) {
        return res.status(400).json({
            error: 'La cédula de un funcionario nacional no puede tener más ni menos de 9 dígitos.',
            codigo: 'MSG-REG-ERR-003'
        });
    }
    if (cedulaLimpia.length > 12) {
        return res.status(400).json({
            error: 'El pasaporte o DIMEX del funcionario no puede tener menos de 9 dígitos ni más de 12 dígitos.',
            codigo: 'MSG-REG-ERR-004'
        });
    }

    // ── V4: Formato email ─────────────────────────────────────────────────────
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({
            error: 'Por favor ingrese el correo electrónico en un formato válido. Ejemplo: juan@correo.com',
            codigo: 'MSG-REG-ERR-005'
        });
    }

    // ── Contraseña mínimo 8 caracteres ────────────────────────────────────────
    if (String(contrasena).length < 8) {
        return res.status(400).json({
            error: 'La contraseña debe tener al menos 8 caracteres.',
            codigo: 'MSG-REG-ERR-PASS'
        });
    }

    // ── V8: Fecha de ingreso no posterior a hoy ───────────────────────────────
    if (fecha_ingreso) {
        const hoy = new Date().toISOString().split('T')[0];
        if (fecha_ingreso > hoy) {
            return res.status(400).json({
                error: `La fecha de ingreso no puede ser posterior a la fecha actual. Fecha de hoy: ${hoy}`,
                codigo: 'MSG-REG-ERR-009'
            });
        }
    }

    // ── V9: Saldo de vacaciones 0–30 ─────────────────────────────────────────
    const diasAcum = parseFloat(dias_vacaciones_acumulados) || 0;
    const diasDisp = parseFloat(dias_vacaciones_disponibles) || 0;
    if (diasAcum < 0 || diasAcum > 30 || diasDisp < 0 || diasDisp > 30) {
        return res.status(400).json({
            error: 'El saldo de vacaciones no puede ser un valor negativo ni mayor a 30 días.',
            codigo: 'MSG-REG-ERR-010'
        });
    }

    try {
        // ── Verificar unicidad antes de insertar ──────────────────────────────
        const [duplicados] = await db.query(
            `SELECT cedula, email, usuario FROM funcionarios
             WHERE cedula = ? OR email = ? OR usuario = ?
             LIMIT 1`,
            [cedulaLimpia, String(email).trim(), String(usuario).trim()]
        );

        if (duplicados.length > 0) {
            const dup = duplicados[0];
            if (dup.cedula === cedulaLimpia)
                return res.status(409).json({ error: 'Ya existe un funcionario registrado con esa cédula.', codigo: 'MSG-REG-ERR-DUP-CED' });
            if (dup.email === String(email).trim())
                return res.status(409).json({ error: 'Ya existe un funcionario registrado con ese correo electrónico.', codigo: 'MSG-REG-ERR-DUP-EMAIL' });
            return res.status(409).json({ error: 'Ya existe un funcionario registrado con ese nombre de usuario.', codigo: 'MSG-REG-ERR-DUP-USR' });
        }

        // ── INSERT funcionario ────────────────────────────────────────────────
        const [result] = await db.query(
            `INSERT INTO funcionarios
                (cedula, nombre, apellido1, apellido2,
                 email, telefono,
                 id_departamento, id_cargo, id_tipo_nombramiento, id_supervisor,
                 fecha_ingreso, fecha_salida,
                 fecha_nombramiento, numero_nombramiento, fecha_fin_nombramiento,
                 en_periodo_prueba, fecha_fin_periodo_prueba,
                 id_periodo_lectivo_activo,
                 dias_vacaciones_acumulados, dias_vacaciones_disponibles,
                 estado_contrato, usuario, contrasena,
                 rol, estado,
                 historial_nombramientos, intentos_fallidos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                cedulaLimpia,
                String(nombre).trim(),
                String(apellido1).trim(),
                apellido2?.trim() || null,
                String(email).trim(),
                telefono?.trim() || null,
                parseInt(id_departamento),
                parseInt(id_cargo),
                id_tipo_nombramiento ? parseInt(id_tipo_nombramiento) : null,
                id_supervisor ? parseInt(id_supervisor) : null,
                fecha_ingreso,
                fecha_salida || null,
                fecha_nombramiento || null,
                numero_nombramiento?.trim() || null,
                fecha_fin_nombramiento || null,
                en_periodo_prueba ? 1 : 0,
                fecha_fin_periodo_prueba || null,
                id_periodo_lectivo_activo ? parseInt(id_periodo_lectivo_activo) : null,
                diasAcum,
                diasDisp,
                estado_contrato || 'activo',
                String(usuario).trim(),
                contrasena,           // en producción: hashear antes de almacenar
                role || 'funcionario',
                estado || 'activo',
                historial_nombramientos || null
            ]
        );

        return res.status(201).json({
            mensaje: 'El usuario fue creado exitosamente. El funcionario puede revisar su correo electrónico para obtener sus credenciales de acceso.',
            codigo: 'MSG-REG-001',
            id_funcionario: result.insertId
        });

    } catch (err) {
        console.error('[registro.controller] registrarFuncionario error:', err.message);

        // Duplicado detectado por MySQL (race condition entre verificación e INSERT)
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Ya existe un funcionario con alguno de los datos únicos ingresados (cédula, email o usuario).',
                codigo: 'MSG-REG-ERR-012'
            });
        }

        return res.status(500).json({
            error: 'Error interno de la aplicación. Por favor reintente en unos minutos. Si el error persiste, comuníquese con el equipo de TI.',
            codigo: 'MSG-REG-ERR-012'
        });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/registro/funcionarios/lista
// Devuelve lista básica de funcionarios activos para selector de supervisor
// ─────────────────────────────────────────────────────────────────────────────
exports.listarFuncionarios = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT f.id_funcionario, f.nombre, f.apellido1, f.apellido2,
                    d.nombre_departamento, f.id_departamento
             FROM funcionarios f
             LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
             WHERE f.estado = 'activo'
             ORDER BY f.apellido1, f.nombre`
        );
        return res.json(rows);
    } catch (err) {
        console.error('[registro.controller] listarFuncionarios error:', err.message);
        return res.status(500).json({ error: 'Error al cargar lista de funcionarios.' });
    }
};