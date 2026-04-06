/**
 * session.js — RQ-SVC-2026-08 Seguridad, V5
 * Gestión de sesión: inactividad (10 min), validación de token y cierre de sesión.
 *
 * Incluir en TODAS las páginas protegidas (después de cargar navbar.js):
 *   <script src="/frontend/js/session.js"></script>
 *
 * En login.html NO se incluye este archivo.
 */

(function () {
    'use strict';

    const API_BASE = 'http://localhost:3000';
    const INACTIVIDAD_MS = 10 * 60 * 1000; // 10 minutos — V5
    const LOGIN_URL = '/frontend/pages/autenticacion/login.html';

    let timerInactividad = null;

    // ── Leer sesión del localStorage ──────────────────────────────────────────
    function getSesion() {
        try {
            return {
                funcionario: JSON.parse(localStorage.getItem('funcionario') || 'null'),
                tipoNombramiento: JSON.parse(localStorage.getItem('tipoNombramiento') || 'null'),
                nombramientos: JSON.parse(localStorage.getItem('nombramientos') || '[]'),
                sessionToken: localStorage.getItem('sessionToken'),
                sessionExpiry: parseInt(localStorage.getItem('sessionExpiry') || '0', 10),
                token: localStorage.getItem('token'),
                tokenExpiry: parseInt(localStorage.getItem('tokenExpiry') || '0', 10),
            };
        } catch {
            return null;
        }
    }

    // ── Limpiar sesión del localStorage ──────────────────────────────────────
    function limpiarSesion() {
        ['funcionario', 'tipoNombramiento', 'nombramientos', 'sessionToken', 'sessionExpiry', 'token', 'tokenExpiry']
            .forEach(k => localStorage.removeItem(k));
    }

    // ── Hook fetch: añade Authorization: Bearer <JWT> a llamadas /api/* ────────
    const _fetch = window.fetch ? window.fetch.bind(window) : null;
    if (_fetch) {
        window.fetch = function (input, init) {
            try {
                const sesion = getSesion();
                const token = sesion?.token;

                const url = (typeof input === 'string')
                    ? input
                    : (input && typeof input.url === 'string' ? input.url : '');

                const esApi = url.startsWith(API_BASE + '/api/');
                if (!esApi || !token) return _fetch(input, init);
                if (url.includes('/api/auth/login')) return _fetch(input, init);

                if (typeof Request !== 'undefined' && input instanceof Request) {
                    const headers = new Headers(input.headers);
                    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
                    const req = new Request(input, { headers });
                    return _fetch(req, init);
                }

                const headers = new Headers((init && init.headers) ? init.headers : undefined);
                if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
                return _fetch(input, { ...(init || {}), headers });
            } catch {
                return _fetch(input, init);
            }
        };
    }

    // ── Cerrar sesión (manual o por inactividad) ─────────────────────────────
    async function cerrarSesion(motivo = 'manual') {
        clearTimeout(timerInactividad);

        const { funcionario, sessionToken } = getSesion() || {};

        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_funcionario: funcionario?.id_funcionario || null,
                    usuario: funcionario?.usuario || null,
                    sessionToken,
                    motivo
                })
            });
        } catch { /* si el servidor no responde igual limpiamos la sesión */ }

        limpiarSesion();

        const param = motivo === 'inactividad' ? '?motivo=inactividad' : '';
        window.location.href = LOGIN_URL + param;
    }

    // Exponer para el botón "Cerrar sesión" del navbar
    window.logout = () => cerrarSesion('manual');

    // ── Reiniciar timer de inactividad ────────────────────────────────────────
    function reiniciarTimer() {
        clearTimeout(timerInactividad);

        // Actualizar expiry en localStorage con cada actividad
        localStorage.setItem('sessionExpiry', String(Date.now() + INACTIVIDAD_MS));

        timerInactividad = setTimeout(() => {
            cerrarSesion('inactividad');
        }, INACTIVIDAD_MS);
    }

    // ── Eventos de actividad del usuario ────────────────────────────────────
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
        .forEach(ev => document.addEventListener(ev, reiniciarTimer, { passive: true }));

    // ── Validar sesión al cargar la página ───────────────────────────────────
    function validarSesion() {
        const sesion = getSesion();

        if (!sesion || !sesion.funcionario || !sesion.sessionToken || !sesion.token) {
            // No hay sesión — redirigir al login
            limpiarSesion();
            window.location.href = LOGIN_URL;
            return;
        }

        if (Date.now() > sesion.sessionExpiry) {
            // El token expiró por inactividad mientras la pestaña estaba cerrada
            cerrarSesion('inactividad');
            return;
        }

        // Sesión válida — arrancar timer
        reiniciarTimer();
    }

    // ── Poblar datos del usuario en el navbar (si ya existe el elemento) ─────
    function poblarNavbar() {
        const sesion = getSesion();
        if (!sesion?.funcionario) return;

        const f = sesion.funcionario;
        const iniciales = [f.nombre, f.apellido1]
            .filter(Boolean)
            .map(s => s[0].toUpperCase())
            .join('');

        const navAvatar = document.getElementById('navAvatar');
        const navName = document.getElementById('navName');
        const pillNom = document.getElementById('pillNomLabel');

        if (navAvatar) navAvatar.textContent = iniciales || '?';
        if (navName) navName.textContent = f.nombre || 'Usuario';
        if (pillNom) pillNom.textContent = sesion.tipoNombramiento?.nombre_tipo || f.rol || '';
    }

    // Esperar a que el navbar custom element esté listo
    document.addEventListener('navbar-ready', poblarNavbar);
    // Por si ya estaba antes
    if (document.querySelector('.topnav')) poblarNavbar();

    // Iniciar validación
    validarSesion();

})();
