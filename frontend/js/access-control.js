/**
 * access-control.js — SIGEVAC
 * Control de acceso por rol para rutas y submodulos.
 *
 * Uso en cada página protegida:
 *   <script src="/frontend/js/access-control.js"></script>
 *
 * Debe cargarse DESPUÉS de session.js (que ya valida el token).
 */

(function () {
    'use strict';

    // ── Roles con acceso total ─────────────────────────────────────────────────
    const ROLES_ADMIN = ['rrhh', 'jefe', 'admin'];

    // ── Mapa de restricciones para el rol "funcionario" ───────────────────────
    // Cada entrada: { module: string, submodule: string|null }
    // submodule null = todo el módulo está restringido
    const RESTRICCIONES_FUNCIONARIO = [
        { module: 'autenticacion', submodule: null },   // módulo completo bloqueado
        { module: 'aprobacion',    submodule: null },   // módulo completo bloqueado
        { module: 'saldo',         submodule: 'historial-departamento' }, // solo este sub
    ];

    // ── Obtener rol desde localStorage ────────────────────────────────────────
    function getRol() {
        try {
            const f = JSON.parse(localStorage.getItem('funcionario') || '{}');
            return (f.rol || '').toLowerCase();
        } catch {
            return '';
        }
    }

    // ── Verificar si la URL actual está restringida para el rol dado ──────────
    // Recibe el pathname, ej: "/frontend/pages/autenticacion/usuarios.html"
    // o "/frontend/pages/saldo/historial-departamento.html"
    function estaRestringido(pathname, rol) {
        if (ROLES_ADMIN.includes(rol)) return false; // admin/jefe/rrhh: acceso total

        if (rol !== 'funcionario') return false; // roles desconocidos: no restringir aquí

        for (const r of RESTRICCIONES_FUNCIONARIO) {
            if (r.submodule === null) {
                // Módulo completo bloqueado
                if (pathname.includes(`/${r.module}/`)) return true;
            } else {
                // Solo el submódulo específico
                if (pathname.includes(`/${r.module}/`) && pathname.includes(r.submodule)) return true;
            }
        }
        return false;
    }

    // ── Redirigir si no tiene permiso ─────────────────────────────────────────
    function verificarAcceso() {
        const rol = getRol();
        const pathname = window.location.pathname;

        if (estaRestringido(pathname, rol)) {
            // Redirigir al dashboard con parámetro de error
            window.location.replace('/frontend/pages/dashboard.html?error=acceso_denegado');
        }
    }

    // ── Ocultar ítems del navbar sin permiso ──────────────────────────────────
    // Llama esta función después de que el navbar esté renderizado.
    // Usa el atributo data-module y data-submodule en los <a> / .nav-sub-item del navbar.
    // Ejemplo en navbar.js:
    //   <a data-module="autenticacion" href="...">Usuarios</a>
    //   <a data-module="saldo" data-submodule="historial-departamento" href="...">Historial Dpto</a>
    function ocultarNavItems() {
        const rol = getRol();
        if (ROLES_ADMIN.includes(rol)) return; // admin ve todo
        if (rol !== 'funcionario') return;

        RESTRICCIONES_FUNCIONARIO.forEach(r => {
            let selector;
            if (r.submodule === null) {
                selector = `[data-module="${r.module}"]`;
            } else {
                selector = `[data-module="${r.module}"][data-submodule="${r.submodule}"]`;
            }
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
            });
        });
    }

    // ── API pública ───────────────────────────────────────────────────────────
    window.AccessControl = {
        getRol,
        estaRestringido,
        ocultarNavItems,
        esAdmin: () => ROLES_ADMIN.includes(getRol()),
        esFuncionario: () => getRol() === 'funcionario',
        ROLES_ADMIN,
        RESTRICCIONES_FUNCIONARIO,
    };

    // Verificar acceso inmediatamente al cargar el script
    verificarAcceso();

    // Ocultar ítems cuando el navbar esté listo
    document.addEventListener('navbar-ready', ocultarNavItems);
    // Por si el navbar ya estaba renderizado
    if (document.querySelector('.topnav')) ocultarNavItems();

})();