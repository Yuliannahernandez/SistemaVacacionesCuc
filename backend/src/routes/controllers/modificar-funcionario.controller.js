// src/routes/controllers/modificar-funcionario.controller.js
'use strict';

const db = require('./db');

// ─── GET /api/modificacion/funcionarios/:cedula ───────────────────────────────
exports.buscarFuncionario = async (req, res) => {
    const cedula = String(req.params.cedula || '').trim().replace(/-/g, '');

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
        // ── Query principal: solo tabla funcionarios ──────────────────────────
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
                f.id_periodo_lectivo_activo,
                f.en_periodo_prueba,
                f.fecha_fin_periodo_prueba
             FROM funcionarios f
             LEFT JOIN departamentos d ON f.id_departamento = d.id_departamento
             LEFT JOIN cargos        c ON f.id_cargo        = c.id_cargo
             WHERE f.cedula = ?
             LIMIT 1`,
            [cedula]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'No se encontró ningún funcionario con la cédula ingresada.',
                codigo: 'MSG-MOD-ERR-002'
            });
        }

        const funcionario = rows[0];

        // ── Query secundaria: todos los nombramientos del funcionario ─────────
        const [noms] = await db.query(
            `SELECT
                fn.id_nombramiento,
                fn.id_tipo_nombramiento,
                t.nombre_tipo,
                fn.numero_nombramiento,
                fn.fecha_nombramiento,
                fn.fecha_fin_nombramiento,
                fn.en_periodo_prueba,
                fn.fecha_fin_periodo_prueba,
                fn.id_periodo_lectivo,
                fn.es_activo,
                fn.dias_vacaciones_acumulados,
                fn.dias_vacaciones_disponibles,
                fn.semanas_cumplidas,
                fn.cumple_minimo_semanas
             FROM funcionarios_nombramientos fn
             LEFT JOIN tipos_nombramiento t ON fn.id_tipo_nombramiento = t.id_tipo_nombramiento
             WHERE fn.id_funcionario = ?
             ORDER BY fn.id_nombramiento ASC`,
            [funcionario.id_funcionario]
        );

        // Si hay registros en la tabla relacional los usa.
        // Si no (funcionario legacy sin migrar), construye una fila
        // con los campos que viven directamente en funcionarios.
        if (noms.length > 0) {
            funcionario.nombramientos = noms;
        } else {
            funcionario.nombramientos = [{
                id_nombramiento: null,
                id_tipo_nombramiento: funcionario.id_tipo_nombramiento || null,
                nombre_tipo: null,
                numero_nombramiento: funcionario.numero_nombramiento || null,
                fecha_nombramiento: funcionario.fecha_nombramiento || null,
                fecha_fin_nombramiento: funcionario.fecha_fin_nombramiento || null,
                en_periodo_prueba: funcionario.en_periodo_prueba || 0,
                fecha_fin_periodo_prueba: funcionario.fecha_fin_periodo_prueba || null,
                id_periodo_lectivo: funcionario.id_periodo_lectivo_activo || null,
                es_activo: 1,
                dias_vacaciones_acumulados: funcionario.dias_vacaciones_acumulados || 0,
                dias_vacaciones_disponibles: funcionario.dias_vacaciones_disponibles || 0,
                semanas_cumplidas: null,
                cumple_minimo_semanas: null
            }];
        }

        return res.json(funcionario);

    } catch (err) {
        console.error('[modificar.controller] buscarFuncionario error:', err.message);
        return res.status(500).json({
            error: 'Error interno de la aplicación. Por favor reintente en unos minutos.',
            codigo: 'MSG-MOD-ERR-003'
        });
    }
};

// ─── PUT /api/modificacion/funcionarios/:id ───────────────────────────────────
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
        usuario, role,
        nombramientos,       // array desde el front
        campos_modificados
    } = req.body;

    // ── V3: Campos obligatorios ───────────────────────────────────────────────
    const obligatorios = {
        cedula, nombre, apellido1, email, telefono,
        id_departamento, id_cargo, tipo_funcionario, condicion,
        fecha_ingreso, fecha_ingreso_sector_publico, usuario
    };
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
            error: 'La cédula no puede tener menos de 9 dígitos.',
            codigo: 'MSG-MOD-ERR-006'
        });
    }
    if (cedulaLimpia.length > 12) {
        return res.status(400).json({
            error: 'El pasaporte o DIMEX no puede tener más de 12 dígitos.',
            codigo: 'MSG-MOD-ERR-007'
        });
    }

    // ── V6: Formato email ─────────────────────────────────────────────────────
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({
            error: 'Por favor ingrese el correo electrónico en un formato válido.',
            codigo: 'MSG-MOD-ERR-008'
        });
    }

    // ── V7: Teléfono solo números ─────────────────────────────────────────────
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
                error: 'La fecha de nacimiento debe corresponder a una persona mayor de 18 años.',
                codigo: 'MSG-MOD-ERR-010'
            });
        }
    }

    // ── V9: Campos laborales mínimos ──────────────────────────────────────────
    if (!id_departamento || !role || !tipo_funcionario || !condicion) {
        return res.status(400).json({
            error: 'La información laboral debe contener al menos departamento, rol, tipo y condición.',
            codigo: 'MSG-MOD-ERR-011'
        });
    }

    // ── V10: Fechas ≤ hoy ─────────────────────────────────────────────────────
    const hoy = new Date().toISOString().split('T')[0];
    if (fecha_ingreso > hoy) {
        return res.status(400).json({
            error: 'La fecha de ingreso no puede ser posterior a hoy (' + hoy + ').',
            codigo: 'MSG-MOD-ERR-012'
        });
    }
    if (fecha_ingreso_sector_publico && fecha_ingreso_sector_publico > hoy) {
        return res.status(400).json({
            error: 'La fecha de ingreso al sector público no puede ser posterior a hoy (' + hoy + ').',
            codigo: 'MSG-MOD-ERR-012'
        });
    }

    // ── V12: Código administrativo no negativo ────────────────────────────────
    const codAdmin = (codigo_administrativo !== undefined && codigo_administrativo !== null && codigo_administrativo !== '')
        ? parseInt(codigo_administrativo)
        : null;
    if (codAdmin !== null && codAdmin < 0) {
        return res.status(400).json({
            error: 'El código administrativo no puede ser un valor negativo.',
            codigo: 'MSG-MOD-ERR-014'
        });
    }

    // ── V13: Al menos un nombramiento válido ──────────────────────────────────
    if (!Array.isArray(nombramientos) || nombramientos.length === 0 || !nombramientos[0].id_tipo_nombramiento) {
        return res.status(400).json({
            error: 'Debe registrar al menos un nombramiento con tipo seleccionado.',
            codigo: 'MSG-MOD-ERR-015'
        });
    }

    // ── Normalizar enums ──────────────────────────────────────────────────────
    const rolFinal = (['funcionario', 'jefe', 'admin', 'rrhh'].includes(role)) ? role : 'funcionario';
    const estadoFinal = (['activo', 'inactivo', 'bloqueado'].includes(estado)) ? estado : 'activo';
    const supervisorId = (id_supervisor && parseInt(id_supervisor) > 0) ? parseInt(id_supervisor) : null;

    // Nombramiento principal → actualiza también los campos legacy de funcionarios
    const nomP = nombramientos[0];

    try {
        // ── Verificar que el funcionario exista ───────────────────────────────
        const [existing] = await db.query(
            'SELECT id_funcionario, cedula, email, usuario FROM funcionarios WHERE id_funcionario = ? LIMIT 1',
            [id_funcionario]
        );
        if (existing.length === 0) {
            return res.status(404).json({
                error: 'No se encontró ningún funcionario con ese ID.',
                codigo: 'MSG-MOD-ERR-002'
            });
        }
        const actual = existing[0];

        // ── Unicidad: cédula, email, usuario ─────────────────────────────────
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
                    return res.status(409).json({ error: 'Ya existe otro funcionario con esa cédula.', codigo: 'MSG-MOD-ERR-DUP-CED' });
                if (dup.email === String(email).trim())
                    return res.status(409).json({ error: 'Ya existe otro funcionario con ese correo.', codigo: 'MSG-MOD-ERR-DUP-EMAIL' });
                return res.status(409).json({ error: 'Ya existe otro funcionario con ese usuario.', codigo: 'MSG-MOD-ERR-DUP-USR' });
            }
        }

        // ── UPDATE funcionarios ───────────────────────────────────────────────
        // Actualiza datos generales + campos legacy del nombramiento principal
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
                usuario                       = ?,
                rol                           = ?,
                id_tipo_nombramiento          = ?,
                numero_nombramiento           = ?,
                fecha_nombramiento            = ?,
                fecha_fin_nombramiento        = ?,
                en_periodo_prueba             = ?,
                fecha_fin_periodo_prueba      = ?,
                id_periodo_lectivo_activo     = ?,
                fecha_modificacion            = NOW()
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
                String(usuario).trim(),
                rolFinal,
                // campos legacy sincronizados con el nombramiento principal
                nomP.id_tipo_nombramiento || null,
                nomP.numero_nombramiento || null,
                nomP.fecha_nombramiento || null,
                nomP.fecha_fin_nombramiento || null,
                nomP.en_periodo_prueba !== undefined ? nomP.en_periodo_prueba : 0,
                nomP.fecha_fin_periodo_prueba || null,
                nomP.id_periodo_lectivo || null,
                id_funcionario
            ]
        );

        // ── Sincronizar funcionarios_nombramientos (UPDATE/INSERT/DELETE seguro) ──
        const idsEnviados = []; // ids que vienen del front y ya existen en BD

        for (const nom of nombramientos) {
            if (!nom.id_tipo_nombramiento) continue;

            if (nom.id_nombramiento) {
                // Ya existe → UPDATE
                await db.query(
                    // UPDATE — agrega dos campos antes del WHERE:
                    `UPDATE funcionarios_nombramientos SET
    id_tipo_nombramiento          = ?,
    numero_nombramiento           = ?,
    fecha_nombramiento            = ?,
    fecha_fin_nombramiento        = ?,
    en_periodo_prueba             = ?,
    fecha_fin_periodo_prueba      = ?,
    id_periodo_lectivo            = ?,
    dias_vacaciones_acumulados    = ?,
    dias_vacaciones_disponibles   = ?
 WHERE id_nombramiento = ? AND id_funcionario = ?`,
                    [
                        nom.id_tipo_nombramiento,
                        nom.numero_nombramiento || null,
                        nom.fecha_nombramiento || null,
                        nom.fecha_fin_nombramiento || null,
                        nom.en_periodo_prueba !== undefined ? nom.en_periodo_prueba : 0,
                        nom.fecha_fin_periodo_prueba || null,
                        nom.id_periodo_lectivo || null,
                        parseFloat(nom.dias_vacaciones_acumulados) || 0,  // ← nuevo
                        parseFloat(nom.dias_vacaciones_disponibles) || 0,  // ← nuevo
                        nom.id_nombramiento,
                        id_funcionario
                    ]
                );
                idsEnviados.push(nom.id_nombramiento);
            } else {
                // Nuevo nombramiento → INSERT
                const [result] = await db.query(

                    `INSERT INTO funcionarios_nombramientos
    (id_funcionario, id_tipo_nombramiento, numero_nombramiento,
     fecha_nombramiento, fecha_fin_nombramiento,
     en_periodo_prueba, fecha_fin_periodo_prueba,
     id_periodo_lectivo, es_activo, fecha_creacion,
     dias_vacaciones_acumulados, dias_vacaciones_disponibles)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?)`,
                    [
                        id_funcionario,
                        nom.id_tipo_nombramiento,
                        nom.numero_nombramiento || null,
                        nom.fecha_nombramiento || null,
                        nom.fecha_fin_nombramiento || null,
                        nom.en_periodo_prueba !== undefined ? nom.en_periodo_prueba : 0,
                        nom.fecha_fin_periodo_prueba || null,
                        nom.id_periodo_lectivo || null,
                        parseFloat(nom.dias_vacaciones_acumulados) || 0,  // ← nuevo
                        parseFloat(nom.dias_vacaciones_disponibles) || 0   // ← nuevo
                    ]
                );
                idsEnviados.push(result.insertId);
            }
        }

        // Eliminar solo los nombramientos que el usuario quitó del formulario
        // y que NO tienen solicitudes asociadas
        if (idsEnviados.length > 0) {
            const placeholders = idsEnviados.map(() => '?').join(',');
            await db.query(
                `DELETE FROM funcionarios_nombramientos
         WHERE id_funcionario = ?
           AND id_nombramiento NOT IN (${placeholders})
           AND id_nombramiento NOT IN (
               SELECT id_nombramiento FROM solicitudes_vacaciones
               WHERE id_nombramiento IS NOT NULL
           )`,
                [id_funcionario, ...idsEnviados]
            );
        }
        // ── Auditoría ─────────────────────────────────────────────────────────
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
            console.warn('[modificar.controller] No se pudo insertar en auditoría:', auditErr.message);
        }

        return res.json({
            mensaje: 'El funcionario fue modificado exitosamente.',
            codigo: 'MSG-MOD-001',
            id_funcionario
        });

    } catch (err) {
        console.error('[modificar.controller] modificarFuncionario error:', err.message, '| code:', err.code);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Ya existe un funcionario con alguno de los datos únicos ingresados.',
                codigo: 'MSG-MOD-ERR-DUP'
            });
        }
        return res.status(500).json({
            error: 'Error interno de la aplicación. Por favor reintente en unos minutos.',
            codigo: 'MSG-MOD-ERR-003'
        });
    }
};