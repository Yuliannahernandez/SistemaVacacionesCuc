// src/routes/controllers/registro-funcionario.controller.js
'use strict';

const db = require('./db');
const crypto = require('crypto');

// ─── Utilidad: genera contraseña aleatoria de 12 caracteres ──────────────────
function generarContrasena() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let pass = '';
    for (let i = 0; i < 12; i++) pass += chars[bytes[i] % chars.length];
    return pass;
}

// ─── Utilidad: envía credenciales por correo ─────────────────────────────────
async function enviarCredenciales(email, usuario, contrasena) {
    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch (e) {
        console.warn('[registro.controller] nodemailer no instalado. Ejecute: npm install nodemailer');
        console.warn(`[registro.controller] Credenciales para ${email}: usuario=${usuario} / pass=${contrasena}`);
        return;
    }
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.example.com',
        port: parseInt(process.env.MAIL_PORT) || 587,
        secure: false,
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    });
    await transporter.sendMail({
        from: process.env.MAIL_FROM || '"SIGEVAC" <noreply@cuc.ac.cr>',
        to: email,
        subject: 'Sus credenciales de acceso — SIGEVAC',
        html: `
        <p>Estimado/a funcionario/a,</p>
        <p>Se ha creado su cuenta en el sistema SIGEVAC. Sus credenciales de acceso son:</p>
        <ul>
            <li><strong>Usuario:</strong> ${usuario}</li>
            <li><strong>Contraseña inicial:</strong> ${contrasena}</li>
        </ul>
        <p>Por seguridad, se le solicitará cambiar su contraseña en el primer inicio de sesión.</p>
        <p>Saludos,<br>Equipo de RRHH — SIGEVAC</p>`
    });
}

// ─── Utilidad: calcula saldo de vacaciones para interinos (PA-GIRH-10) ───────
function calcularVacacionesInterino(fecha_ingreso) {
    if (!fecha_ingreso) return 0;
    const diasTrabajados = Math.floor((new Date() - new Date(fecha_ingreso)) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(30, Math.floor((diasTrabajados / 365) * 14 * 100) / 100));
}

// ─── POST /api/registro/funcionarios ─────────────────────────────────────────
exports.registrarFuncionario = async (req, res) => {
    const {
        cedula, nombre, apellido1, apellido2,
        email, telefono,
        fecha_nacimiento,
        id_departamento, id_cargo, id_supervisor,
        tipo_funcionario, condicion, codigo_administrativo,
        fecha_ingreso, fecha_ingreso_sector_publico,
        en_periodo_prueba, fecha_fin_periodo_prueba,
        dias_vacaciones_acumulados, dias_vacaciones_disponibles,
        estado_contrato,
        usuario, role, estado,
        historial_nombramientos,
        nombramientos
    } = req.body;

    // ── Extraer datos del nombramiento principal (primera fila) ───────────────
    const nomRows = Array.isArray(nombramientos) ? nombramientos : [];
    const nomPrincipal = nomRows.length > 0 ? nomRows[0] : null;

    const id_tipo_nombramiento = (nomPrincipal?.id_tipo_nombramiento && parseInt(nomPrincipal.id_tipo_nombramiento) > 0)
        ? parseInt(nomPrincipal.id_tipo_nombramiento)
        : null;
    const fecha_nombramiento = nomPrincipal?.fecha_nombramiento || null;
    const numero_nombramiento = nomPrincipal?.numero_nombramiento || null;
    const fecha_fin_nombramiento = nomPrincipal?.fecha_fin_nombramiento || null;
    const id_periodo_lectivo_activo = (nomPrincipal?.id_periodo_lectivo && parseInt(nomPrincipal.id_periodo_lectivo) > 0)
        ? parseInt(nomPrincipal.id_periodo_lectivo)
        : null;

    // ── V1: Campos obligatorios ───────────────────────────────────────────────
    const camposObligatorios = {
        cedula, nombre, apellido1, email, telefono,
        id_departamento, id_cargo,
        fecha_ingreso,
        usuario
    };
    for (const [campo, valor] of Object.entries(camposObligatorios)) {
        if (valor === undefined || valor === null || String(valor).trim() === '') {
            return res.status(400).json({
                error: 'Por favor complete y/o seleccione todos los campos obligatorios.',
                codigo: 'MSG-REG-ERR-001', campo
            });
        }
    }

    // ── V2: Nombre máx. 50 caracteres ────────────────────────────────────────
    if (String(nombre).trim().length > 50) {
        return res.status(400).json({
            error: 'Por favor no exceda los 50 caracteres en el campo Nombre Completo.',
            codigo: 'MSG-REG-ERR-002'
        });
    }

    // ── V3: Formato cédula ────────────────────────────────────────────────────
    const cedulaLimpia = String(cedula).trim().replace(/-/g, '');
    if (!/^\d+$/.test(cedulaLimpia) || cedulaLimpia.length < 9) {
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

    // ── V5: Teléfono — solo números ───────────────────────────────────────────
    if (!/^\d+$/.test(String(telefono).trim())) {
        return res.status(400).json({
            error: 'Por favor ingrese un número de teléfono válido. Solo se permiten números.',
            codigo: 'MSG-REG-ERR-006'
        });
    }

    // ── V6: Fecha nacimiento — mayor de 18 años (si se provee) ───────────────
    if (fecha_nacimiento) {
        const hoyD = new Date();
        const fnac = new Date(fecha_nacimiento);
        let edad = hoyD.getFullYear() - fnac.getFullYear();
        const mm = hoyD.getMonth() - fnac.getMonth();
        if (mm < 0 || (mm === 0 && hoyD.getDate() < fnac.getDate())) edad--;
        if (edad < 18) {
            return res.status(400).json({
                error: 'La fecha de nacimiento del funcionario debe corresponder a una persona mayor de 18 años.',
                codigo: 'MSG-REG-ERR-007'
            });
        }
    }

    // ── V7: Al menos 1 nombramiento, y TODOS los agregados deben tener tipo ───
    if (nomRows.length === 0 || !id_tipo_nombramiento) {
        return res.status(400).json({
            error: 'Debe agregar al menos un nombramiento con tipo seleccionado.',
            codigo: 'MSG-REG-ERR-008'
        });
    }
    if (nomRows.some(n => !n.id_tipo_nombramiento || parseInt(n.id_tipo_nombramiento) === 0)) {
        return res.status(400).json({
            error: 'Todos los nombramientos agregados deben tener un tipo seleccionado.',
            codigo: 'MSG-REG-ERR-008'
        });
    }

    // ── V8: Fechas de ingreso ≤ hoy ───────────────────────────────────────────
    const hoy = new Date().toISOString().split('T')[0];
    if (fecha_ingreso > hoy) {
        return res.status(400).json({
            error: 'La fecha de ingreso no puede ser posterior a la fecha actual. Fecha de hoy: ' + hoy,
            codigo: 'MSG-REG-ERR-009'
        });
    }
    if (fecha_ingreso_sector_publico && fecha_ingreso_sector_publico > hoy) {
        return res.status(400).json({
            error: 'La fecha de ingreso al sector público no puede ser posterior a la fecha actual.',
            codigo: 'MSG-REG-ERR-009'
        });
    }

    // ── V9: Saldo vacaciones (interinos: calculado; propiedad: 0–30) ──────────
    const tipoNom = parseInt(id_tipo_nombramiento);
    const esInterino = tipoNom === 2 || tipoNom === 4;
    let diasAcum, diasDisp;
    if (esInterino) {
        diasAcum = calcularVacacionesInterino(fecha_ingreso);
        diasDisp = diasAcum;
    } else {
        diasAcum = parseFloat(dias_vacaciones_acumulados) || 0;
        diasDisp = parseFloat(dias_vacaciones_disponibles) || 0;
        if (diasAcum < 0 || diasAcum > 30 || diasDisp < 0 || diasDisp > 30) {
            return res.status(400).json({
                error: 'El saldo de vacaciones no puede ser un valor negativo ni mayor a 30 días.',
                codigo: 'MSG-REG-ERR-010'
            });
        }
    }

    // ── V10: Código administrativo no negativo (si se provee) ────────────────
    const codAdmin = (codigo_administrativo !== undefined && codigo_administrativo !== null && codigo_administrativo !== '')
        ? parseInt(codigo_administrativo)
        : null;
    if (codAdmin !== null && codAdmin < 0) {
        return res.status(400).json({
            error: 'El código administrativo / número de carpeta no puede ser un valor negativo.',
            codigo: 'MSG-REG-ERR-011'
        });
    }

    // ── Normalizar enums y opcionales ─────────────────────────────────────────
    const rolFinal = (role && ['funcionario', 'jefe', 'admin', 'rrhh'].includes(role)) ? role : 'funcionario';
    const estadoFinal = (estado && ['activo', 'inactivo', 'bloqueado'].includes(estado)) ? estado : 'activo';
    const estadoCont = (estado_contrato && ['activo', 'inactivo', 'suspendido'].includes(estado_contrato)) ? estado_contrato : 'activo';
    const supervisorId = (id_supervisor && parseInt(id_supervisor) > 0) ? parseInt(id_supervisor) : null;

    try {
        // ── Verificar unicidad ────────────────────────────────────────────────
        const [duplicados] = await db.query(
            `SELECT cedula, email, usuario FROM funcionarios
             WHERE cedula = ? OR email = ? OR usuario = ? LIMIT 1`,
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

        const contrasenaGenerada = generarContrasena();

        // ── INSERT funcionarios ───────────────────────────────────────────────
        const [result] = await db.query(
            `INSERT INTO funcionarios
                (cedula, nombre, apellido1, apellido2,
                 fecha_nacimiento,
                 email, telefono,
                 id_departamento, id_cargo, tipo_funcionario, condicion, codigo_administrativo,
                 id_tipo_nombramiento, id_supervisor,
                 fecha_ingreso, fecha_ingreso_sector_publico,
                 fecha_nombramiento, numero_nombramiento, fecha_fin_nombramiento,
                 en_periodo_prueba, fecha_fin_periodo_prueba,
                 id_periodo_lectivo_activo,
                 dias_vacaciones_acumulados, dias_vacaciones_disponibles,
                 estado_contrato, usuario, contrasena,
                 rol, estado,
                 historial_nombramientos,
                 intentos_fallidos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                cedulaLimpia,
                String(nombre).trim(),
                String(apellido1).trim(),
                apellido2?.trim() || null,
                fecha_nacimiento || null,
                String(email).trim(),
                String(telefono).trim(),
                parseInt(id_departamento),
                parseInt(id_cargo),
                tipo_funcionario || null,
                condicion || null,
                codAdmin,
                tipoNom,
                supervisorId,
                fecha_ingreso,
                fecha_ingreso_sector_publico || null,
                fecha_nombramiento || null,
                numero_nombramiento?.trim() || null,
                fecha_fin_nombramiento || null,
                en_periodo_prueba ? 1 : 0,
                fecha_fin_periodo_prueba || null,
                id_periodo_lectivo_activo,
                diasAcum,
                diasDisp,
                estadoCont,
                String(usuario).trim(),
                contrasenaGenerada,
                rolFinal,
                estadoFinal,
                historial_nombramientos?.trim() || null
            ]
        );

        const id_funcionario = result.insertId;

        // ── INSERT funcionarios_nombramientos (todos los nombramientos) ────────
        const inserts = nomRows.map(n => [
            id_funcionario,
            parseInt(n.id_tipo_nombramiento),
            n.numero_nombramiento?.trim() || null,
            n.fecha_nombramiento || null,
            n.fecha_fin_nombramiento || null,
            en_periodo_prueba ? 1 : 0,
            fecha_fin_periodo_prueba || null,
            (n.id_periodo_lectivo && parseInt(n.id_periodo_lectivo) > 0) ? parseInt(n.id_periodo_lectivo) : null,
            1  // es_activo
        ]);
        await db.query(
            `INSERT INTO funcionarios_nombramientos
                (id_funcionario, id_tipo_nombramiento,
                 numero_nombramiento, fecha_nombramiento, fecha_fin_nombramiento,
                 en_periodo_prueba, fecha_fin_periodo_prueba,
                 id_periodo_lectivo, es_activo)
             VALUES ?`,
            [inserts]
        );

        // ── Enviar credenciales por correo ────────────────────────────────────
        let correoEnviado = false;
        try {
            await enviarCredenciales(String(email).trim(), String(usuario).trim(), contrasenaGenerada);
            correoEnviado = true;
        } catch (mailErr) {
            console.error('[registro.controller] Error enviando correo:', mailErr.message);
        }

        return res.status(201).json({
            mensaje: 'El usuario fue creado exitosamente. El funcionario puede revisar su correo electrónico para obtener sus credenciales de acceso.',
            codigo: 'MSG-REG-001',
            id_funcionario,
            correo_enviado: correoEnviado
        });

    } catch (err) {
        console.error('[registro.controller] registrarFuncionario error:', err.message, '| code:', err.code);
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

// ─── GET /api/registro/funcionarios/lista ────────────────────────────────────
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