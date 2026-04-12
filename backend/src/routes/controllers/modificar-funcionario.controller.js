// src/routes/controllers/modificar-funcionario.controller.js
'use strict';

const db = require('./db');

// ─── GET /api/modificacion/funcionarios/:cedula ───────────────────────────────
// Busca un funcionario por cédula y retorna sus datos para pre-llenar el formulario.
exports.buscarFuncionario = async (req, res) => {
    const cedula = String(req.params.cedula || '').trim().replace(/-/g, '');

    // V1 y V2: validación de cédula de búsqueda
    if (!cedula) {
        return res.status(400).json({
            error: 'Por favor ingrese un número de cédula válido para realizar la búsqueda.',
            codigo: 'MSG-MOD-ERR-001'
        });
    }
    if (!/^\d+$/.test(cedula) || cedula.length < 9 || cedula.length > 12) {
        return res.status(400).json({
            error: 'Por favor ingrese un número de cédula válido para realizar la búsqueda.',
            codigo: 'MSG-MOD-ERR-001'
        });
    }

    try {
        const [rows] = await db.query(
            `SELECT
                f.id_funcionario,
                f.cedula,
                f.nombre,
                f.apellido1,
                f.apellido2,
                f.email,
                f.telefono,
                f.fecha_nacimiento,
                f.estado,
                f.id_departamento,
                d.nombre_departamento,
                f.id_cargo,
                c.nombre_cargo,
                f.id_supervisor,
                f.tipo_funcionario,
                f.condicion,
                f.codigo_administrativo,
                f.fecha_ingreso,
                f.fecha_ingreso_sector_publico,
                f.dias_vacaciones_acumulados,
                f.dias_vacaciones_disponibles,
                f.estado_contrato,
                f.usuario,
                f.rol,
                f.id_tipo_nombramiento,
                t.nombre_tipo,
                f.fecha_nombramiento,
                f.numero_nombramiento,
                f.fecha_fin_nombramiento,
                f.id_periodo_lectivo_activo,
                f.en_periodo_prueba,
                f.fecha_fin_periodo_prueba
             FROM funcionarios f
             LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
             LEFT JOIN cargos       c ON f.id_cargo        = c.id_cargo
             LEFT JOIN tipos_nombramiento t ON f.id_tipo_nombramiento = t.id_tipo_nombramiento
             WHERE f.cedula = ?
             LIMIT 1`,
            [cedula]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'No se encontró ningún funcionario con la cédula ingresada. Verifique el número e intente nuevamente.',
                codigo: 'MSG-MOD-ERR-002'
            });
        }

        return res.json(rows[0]);

    } catch (err) {
        console.error('[modificar.controller] buscarFuncionario error:', err.message);
        return res.status(500).json({
            error: 'Error interno de la aplicación. Por favor reintente en unos minutos. Si el error persiste, comuníquese con el equipo de TI.',
            codigo: 'MSG-MOD-ERR-003'
        });
    }
};

// ─── PUT /api/modificacion/funcionarios/:id ───────────────────────────────────
// Actualiza los datos de un funcionario existente y registra la modificación
// en el historial de auditoría.
exports.modificarFuncionario = async (req, res) => {
    const id_funcionario = parseInt(req.params.id);
    if (!id_funcionario || id_funcionario <= 0) {
        return res.status(400).json({ error: 'ID de funcionario inválido.', codigo: 'MSG-MOD-ERR-003' });
    }

    const {
        cedula, nombre, apellido1, apellido2,
        email, telefono, fecha_nacimiento,
        estado,
        id_departamento, id_cargo, id_supervisor,
        tipo_funcionario, condicion, codigo_administrativo,
        fecha_ingreso, fecha_ingreso_sector_publico,
        dias_vacaciones_disponibles,
        usuario,
        role,
        campos_modificados      // array de nombres de campos que el front detectó como cambiados
    } = req.body;

    // ── V3: Campos obligatorios ───────────────────────────────────────────────
    const obligatorios = { cedula, nombre, apellido1, email, telefono,
                           id_departamento, id_cargo, tipo_funcionario, condicion,
                           fecha_ingreso, fecha_ingreso_sector_publico, usuario };
    for (const [campo, valor] of Object.entries(obligatorios)) {
        if (valor === undefined || valor === null || String(valor).trim() === '') {
            return res.status(400).json({
                error: 'Por favor complete y/o seleccione todos los campos obligatorios.',
                codigo: 'MSG-MOD-ERR-004', campo
            });
        }
    }

    // ── V4: Nombre máx. 50 caracteres ─────────────────────────────────────────
    if (String(nombre).trim().length > 50) {
        return res.status(400).json({
            error: 'Por favor no exceda los 50 caracteres en el campo Nombre Completo.',
            codigo: 'MSG-MOD-ERR-005'
        });
    }

    // ── V5: Formato cédula ────────────────────────────────────────────────────
    const cedulaLimpia = String(cedula).trim().replace(/-/g, '');
    if (!/^\d+$/.test(cedulaLimpia) || cedulaLimpia.length < 9) {
        return res.status(400).json({
            error: 'La cédula de un funcionario nacional no puede tener más ni menos de 9 dígitos.',
            codigo: 'MSG-MOD-ERR-006'
        });
    }
    if (cedulaLimpia.length > 12) {
        return res.status(400).json({
            error: 'El pasaporte o DIMEX del funcionario no puede tener menos de 9 dígitos ni más de 12 dígitos.',
            codigo: 'MSG-MOD-ERR-007'
        });
    }

    // ── V6: Formato email ─────────────────────────────────────────────────────
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({
            error: 'Por favor ingrese el correo electrónico en un formato válido. Ejemplo: juan@correo.com',
            codigo: 'MSG-MOD-ERR-008'
        });
    }

    // ── V7: Teléfono — solo números ───────────────────────────────────────────
    if (!/^\d+$/.test(String(telefono).trim())) {
        return res.status(400).json({
            error: 'Por favor ingrese un número de teléfono válido. Solo se permiten números.',
            codigo: 'MSG-MOD-ERR-009'
        });
    }

    // ── V8: Mayor de 18 años ──────────────────────────────────────────────────
    if (fecha_nacimiento) {
        const hoyD = new Date();
        const fnac = new Date(fecha_nacimiento);
        let edad = hoyD.getFullYear() - fnac.getFullYear();
        const mm = hoyD.getMonth() - fnac.getMonth();
        if (mm < 0 || (mm === 0 && hoyD.getDate() < fnac.getDate())) edad--;
        if (edad < 18) {
            return res.status(400).json({
                error: 'La fecha de nacimiento del funcionario debe corresponder a una persona mayor de 18 años.',
                codigo: 'MSG-MOD-ERR-010'
            });
        }
    }

    // ── V9: Al menos departamento + rol + tipo + condición ────────────────────
    if (!id_departamento || !role || !tipo_funcionario || !condicion) {
        return res.status(400).json({
            error: 'La información laboral debe contener al menos una fila con departamento, rol, tipo y condición seleccionados.',
            codigo: 'MSG-MOD-ERR-011'
        });
    }

    // ── V10: Fechas de ingreso ≤ hoy ──────────────────────────────────────────
    const hoy = new Date().toISOString().split('T')[0];
    if (fecha_ingreso > hoy) {
        return res.status(400).json({
            error: 'La fecha de ingreso al sector público / institución no puede ser posterior a la fecha actual. Fecha de hoy: ' + hoy,
            codigo: 'MSG-MOD-ERR-012'
        });
    }
    if (fecha_ingreso_sector_publico && fecha_ingreso_sector_publico > hoy) {
        return res.status(400).json({
            error: 'La fecha de ingreso al sector público / institución no puede ser posterior a la fecha actual. Fecha de hoy: ' + hoy,
            codigo: 'MSG-MOD-ERR-012'
        });
    }

    // ── V11: Saldo 0–30 (solo en propiedad) ───────────────────────────────────
    const saldo = (dias_vacaciones_disponibles !== undefined && dias_vacaciones_disponibles !== null && dias_vacaciones_disponibles !== '')
        ? parseFloat(dias_vacaciones_disponibles)
        : null;
    if (saldo !== null && (isNaN(saldo) || saldo < 0 || saldo > 30)) {
        return res.status(400).json({
            error: 'El saldo de vacaciones no puede ser un valor negativo ni mayor a 30 días.',
            codigo: 'MSG-MOD-ERR-013'
        });
    }

    // ── V12: Código administrativo no negativo ────────────────────────────────
    const codAdmin = (codigo_administrativo !== undefined && codigo_administrativo !== null && codigo_administrativo !== '')
        ? parseInt(codigo_administrativo)
        : null;
    if (codAdmin !== null && codAdmin < 0) {
        return res.status(400).json({
            error: 'El código administrativo / número de carpeta no puede ser un valor negativo.',
            codigo: 'MSG-MOD-ERR-014'
        });
    }

    // ── Normalizar enums ──────────────────────────────────────────────────────
    const rolFinal    = (role && ['funcionario','jefe','admin','rrhh'].includes(role)) ? role : 'funcionario';
    const estadoFinal = (estado && ['activo','inactivo','bloqueado'].includes(estado)) ? estado : 'activo';
    const supervisorId = (id_supervisor && parseInt(id_supervisor) > 0) ? parseInt(id_supervisor) : null;

    try {
        // ── Verificar que el funcionario exista ──────────────────────────────
        const [existing] = await db.query(
            'SELECT id_funcionario, cedula, email, usuario FROM funcionarios WHERE id_funcionario = ? LIMIT 1',
            [id_funcionario]
        );
        if (existing.length === 0) {
            return res.status(404).json({
                error: 'No se encontró ningún funcionario con la cédula ingresada. Verifique el número e intente nuevamente.',
                codigo: 'MSG-MOD-ERR-002'
            });
        }
        const actual = existing[0];

        // ── Verificar unicidad (solo si cambió cédula, email o usuario) ──────
        if (cedulaLimpia !== actual.cedula || String(email).trim() !== actual.email || String(usuario).trim() !== actual.usuario) {
            const [dups] = await db.query(
                `SELECT cedula, email, usuario FROM funcionarios
                 WHERE (cedula = ? OR email = ? OR usuario = ?)
                   AND id_funcionario != ?
                 LIMIT 1`,
                [cedulaLimpia, String(email).trim(), String(usuario).trim(), id_funcionario]
            );
            if (dups.length > 0) {
                const dup = dups[0];
                if (dup.cedula === cedulaLimpia)
                    return res.status(409).json({ error: 'Ya existe otro funcionario registrado con esa cédula.', codigo: 'MSG-MOD-ERR-DUP-CED' });
                if (dup.email === String(email).trim())
                    return res.status(409).json({ error: 'Ya existe otro funcionario registrado con ese correo electrónico.', codigo: 'MSG-MOD-ERR-DUP-EMAIL' });
                return res.status(409).json({ error: 'Ya existe otro funcionario registrado con ese nombre de usuario.', codigo: 'MSG-MOD-ERR-DUP-USR' });
            }
        }

        // ── UPDATE funcionarios ───────────────────────────────────────────────
        await db.query(
            `UPDATE funcionarios SET
                cedula                        = ?,
                nombre                        = ?,
                apellido1                     = ?,
                apellido2                     = ?,
                fecha_nacimiento              = ?,
                email                         = ?,
                telefono                      = ?,
                estado                        = ?,
                id_departamento               = ?,
                id_cargo                      = ?,
                id_supervisor                 = ?,
                tipo_funcionario              = ?,
                condicion                     = ?,
                codigo_administrativo         = ?,
                fecha_ingreso                 = ?,
                fecha_ingreso_sector_publico  = ?,
                dias_vacaciones_disponibles   = ?,
                usuario                       = ?,
                rol                           = ?
             WHERE id_funcionario = ?`,
            [
                cedulaLimpia,
                String(nombre).trim(),
                String(apellido1).trim(),
                apellido2?.trim() || null,
                fecha_nacimiento || null,
                String(email).trim(),
                String(telefono).trim(),
                estadoFinal,
                parseInt(id_departamento),
                parseInt(id_cargo),
                supervisorId,
                tipo_funcionario || null,
                condicion || null,
                codAdmin,
                fecha_ingreso,
                fecha_ingreso_sector_publico || null,
                saldo !== null ? saldo : 0,
                String(usuario).trim(),
                rolFinal,
                id_funcionario
            ]
        );

        // ── INSERT auditoría ──────────────────────────────────────────────────
        // Obtener usuario que ejecuta la acción desde la sesión (si disponible)
        let id_usuario_accion = null;
        try {
            const token = req.headers['x-session-token'] || req.headers['authorization'];
            if (token) {
                const [sesRows] = await db.query(
                    'SELECT id_funcionario FROM sesiones WHERE token = ? AND activa = 1 LIMIT 1',
                    [token]
                );
                if (sesRows.length > 0) id_usuario_accion = sesRows[0].id_funcionario;
            }
        } catch (_) { /* tabla sesiones opcional */ }

        const camposStr = Array.isArray(campos_modificados) ? campos_modificados.join(', ') : 'no especificado';

        try {
            await db.query(
                `INSERT INTO auditoria_modificaciones
                    (id_funcionario_modificado, id_usuario_accion,
                     fecha_hora, campos_modificados, ip_origen)
                 VALUES (?, ?, NOW(), ?, ?)`,
                [
                    id_funcionario,
                    id_usuario_accion,
                    camposStr,
                    req.ip || req.connection?.remoteAddress || null
                ]
            );
        } catch (auditErr) {
            // La auditoría no debe bloquear la respuesta; solo loguear
            console.warn('[modificar.controller] No se pudo insertar en auditoría:', auditErr.message);
        }

        return res.json({
            mensaje: 'El funcionario fue modificado exitosamente.',
            codigo:  'MSG-MOD-001',
            id_funcionario
        });

    } catch (err) {
        console.error('[modificar.controller] modificarFuncionario error:', err.message, '| code:', err.code);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Ya existe un funcionario con alguno de los datos únicos ingresados (cédula, email o usuario).',
                codigo: 'MSG-MOD-ERR-DUP'
            });
        }
        return res.status(500).json({
            error: 'Error interno de la aplicación. Por favor reintente en unos minutos. Si el error persiste, comuníquese con el equipo de TI.',
            codigo: 'MSG-MOD-ERR-003'
        });
    }
};