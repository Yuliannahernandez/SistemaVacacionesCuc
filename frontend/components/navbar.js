class AppNavbar extends HTMLElement {
  connectedCallback() {
    const path = window.location.pathname;

    if (!document.getElementById('navbar-styles')) {
      const style = document.createElement('style');
      style.id = 'navbar-styles';
      style.textContent = `
        /* ── Topnav completo ── */
        .topnav{position:fixed;top:0;left:0;right:0;height:56px;z-index:200;display:flex;align-items:center;padding:0 20px;gap:0;background:rgba(0,45,114,0.96);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.05)}
        .nav-logo{display:flex;align-items:center;gap:10px;margin-right:20px;flex-shrink:0}
        .logo-icon{width:29px;height:29px;border-radius:8px;background:linear-gradient(135deg,#002D72,#7da6d8);display:flex;align-items:center;justify-content:center}
        .logo-icon svg{width:13px;height:13px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round}
        .logo-text strong{font-family:'DM Mono',monospace;font-size:12px;font-weight:400;color:rgba(204,220,240,0.9);letter-spacing:.1em;display:block;line-height:1}
        .logo-text small{font-size:8px;font-weight:300;color:rgba(125,166,216,0.3);letter-spacing:.18em;text-transform:uppercase}
        .nav-vdiv{width:1px;height:18px;background:rgba(255,255,255,0.07);margin-right:16px;flex-shrink:0}
        .nav-sep{width:1px;height:14px;background:rgba(255,255,255,0.07);margin:0 4px;flex-shrink:0}
        .nav-links{display:flex;align-items:center;gap:1px;flex:1}
        .nav-link{display:flex;align-items:center;gap:7px;padding:6px 12px;border-radius:9px;font-size:11.5px;font-weight:300;color:rgba(204,220,240,0.4);text-decoration:none;cursor:pointer;transition:all .2s;white-space:nowrap}
        .nav-link svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;flex-shrink:0}
        .nav-link:hover{background:rgba(255,255,255,0.06);color:rgba(204,220,240,0.7)}
        .nav-link.active{background:rgba(125,166,216,0.11);color:#7da6d8;border:1px solid rgba(125,166,216,0.13)}
        .nav-group{position:relative;flex-shrink:0}
        .nav-group-btn{display:flex;align-items:center;gap:7px;padding:6px 11px;border-radius:9px;font-size:11.5px;font-weight:300;color:rgba(204,220,240,0.4);cursor:pointer;transition:all .2s;white-space:nowrap;user-select:none}
        .nav-group-btn svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;flex-shrink:0}
        .nav-chevron{margin-left:2px;transition:transform .2s;opacity:.5}
        .nav-group-btn:hover{background:rgba(255,255,255,0.06);color:rgba(204,220,240,0.7)}
        .nav-group.open .nav-group-btn{background:rgba(125,166,216,0.11);color:#7da6d8}
        .nav-group.open .nav-chevron{transform:rotate(180deg)}
        .nav-submenu{position:absolute;top:calc(100% + 6px);left:0;min-width:200px;background:rgba(0,31,82,0.97);backdrop-filter:blur(16px);border:1px solid rgba(125,166,216,0.1);border-radius:12px;padding:6px;box-shadow:0 12px 32px rgba(0,0,0,0.25);z-index:300;opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .18s,transform .18s}
        .nav-group.open .nav-submenu{opacity:1;transform:translateY(0);pointer-events:all}
        .nav-sub-item{display:block;padding:8px 12px;border-radius:8px;font-size:11.5px;font-weight:300;color:rgba(204,220,240,0.5);text-decoration:none;cursor:pointer;transition:all .2s;white-space:nowrap}
        .nav-sub-item:hover{background:rgba(125,166,216,0.1);color:rgba(204,220,240,0.85)}
        .nav-sub-item.active{background:rgba(26,91,168,0.15);color:#7da6d8}
        .nav-right{display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0}
        .nav-date{font-size:9.5px;font-weight:300;color:rgba(125,166,216,0.3);font-family:'DM Mono',monospace;margin-right:6px;white-space:nowrap}
        .nav-btn{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;position:relative}
        .nav-btn:hover{background:rgba(255,255,255,0.09)}
        .nav-btn svg{width:13px;height:13px;stroke:rgba(125,166,216,0.5);fill:none;stroke-width:1.5;stroke-linecap:round}
        .notif-dot{position:absolute;top:6px;right:6px;width:5px;height:5px;border-radius:50%;background:#E4002B;border:1.5px solid #002D72}
        .action-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:300;color:rgba(125,166,216,0.38);transition:all .2s;white-space:nowrap}
        .action-btn svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;flex-shrink:0}
        .action-btn:hover{background:rgba(255,255,255,0.05);color:rgba(204,220,240,0.62)}
        .action-btn.logout:hover{color:rgba(228,0,43,0.7)}
        .user-wrap{position:relative;margin-left:3px}
        .user-pill{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 5px;border-radius:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);cursor:pointer;transition:all .2s}
        .user-pill:hover{background:rgba(255,255,255,0.08)}
        .user-wrap.open .user-pill{background:rgba(125,166,216,0.1);border-color:rgba(125,166,216,0.15)}
        .avatar{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#001f52,#1a5ba8);display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:500;color:#fff;flex-shrink:0}
        .user-pill-text{display:flex;flex-direction:column}
        .user-pill-name{font-size:11px;font-weight:300;color:rgba(204,220,240,0.62);line-height:1.1}
        .user-pill-nom{font-size:8.5px;font-weight:300;color:rgba(125,166,216,0.35);letter-spacing:.04em}
        .user-dropdown{position:absolute;top:calc(100% + 7px);right:0;min-width:220px;background:rgba(0,31,82,0.97);backdrop-filter:blur(16px);border:1px solid rgba(125,166,216,0.1);border-radius:14px;padding:12px;box-shadow:0 12px 32px rgba(0,0,0,0.28);z-index:300;opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .18s,transform .18s}
        .user-wrap.open .user-dropdown{opacity:1;transform:translateY(0);pointer-events:all}
        .ud-label{font-size:8px;font-weight:400;letter-spacing:.2em;text-transform:uppercase;color:rgba(125,166,216,0.3);margin-bottom:8px;padding:0 4px;font-family:'DM Mono',monospace}
        .ud-pill{display:flex;flex-direction:column;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,0.03);border:1px solid transparent;cursor:pointer;transition:all .2s;margin-bottom:4px}
        .ud-pill:last-child{margin-bottom:0}
        .ud-pill:hover{background:rgba(125,166,216,0.08)}
        .ud-pill.active{background:rgba(26,91,168,0.15);border-color:rgba(125,166,216,0.18)}
        .ud-pill-name{font-size:11.5px;font-weight:300;color:rgba(204,220,240,0.55)}
        .ud-pill.active .ud-pill-name{color:#7da6d8}
        .ud-pill-sub{font-size:9px;font-weight:300;color:rgba(125,166,216,0.28);margin-top:1px}
        /* Badge de número de nombramiento */
        .ud-pill-num{font-size:8px;font-weight:400;color:rgba(125,166,216,0.25);font-family:'DM Mono',monospace;margin-top:2px;letter-spacing:.06em}
        /* Indicador de loading en pill */
        .pill-loading{opacity:.5;pointer-events:none}
        @keyframes pill-spin{to{transform:rotate(360deg)}}
        .pill-spinner{display:inline-block;width:8px;height:8px;border:1.5px solid rgba(125,166,216,0.3);border-top-color:#7da6d8;border-radius:50%;animation:pill-spin .6s linear infinite;margin-left:4px;vertical-align:middle}
      `;
      document.head.appendChild(style);
    }

    this.innerHTML = `
    <nav class="topnav">
      <div class="nav-logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="logo-text"><strong>SIGEVAC</strong><small>CUC · RRHH</small></div>
      </div>
      <div class="nav-vdiv"></div>

      <div class="nav-links">
        <a class="nav-link ${path.includes('dashboard') ? 'active' : ''}" href="/frontend/pages/dashboard.html">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          Inicio
        </a>
        <div class="nav-sep"></div>

        <div class="nav-group" id="grp-solicitudes">
          <div class="nav-group-btn" onclick="toggleGroup('solicitudes')">
            <svg viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Solicitudes
            <svg class="nav-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="nav-submenu">
            <a class="nav-sub-item ${path.includes('solicitudes/registrar') ? 'active' : ''}" href="/frontend/pages/solicitudes/registrar.html">Registrar Solicitud</a>
            <a class="nav-sub-item ${path.includes('solicitudes/consultar') ? 'active' : ''}" href="/frontend/pages/solicitudes/consultar.html">Consultar Solicitud</a>
            <a class="nav-sub-item ${path.includes('solicitudes/modificar') ? 'active' : ''}" href="/frontend/pages/solicitudes/modificar.html">Modificar Solicitud</a>
            <a class="nav-sub-item ${path.includes('solicitudes/cancelar') ? 'active' : ''}" href="/frontend/pages/solicitudes/cancelar.html">Cancelar Solicitud</a>
            <a class="nav-sub-item ${path.includes('solicitudes/historial') ? 'active' : ''}" href="/frontend/pages/solicitudes/historial.html">Historial Solicitud</a>
          </div>
        </div>

        <div class="nav-group" id="grp-saldo">
          <div class="nav-group-btn" onclick="toggleGroup('saldo')">
            <svg viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
            </svg>
            Saldo
            <svg class="nav-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="nav-submenu">
            <a class="nav-sub-item ${path.includes('saldo/saldo') ? 'active' : ''}" href="/frontend/pages/saldo/saldo.html">Saldo Disponible</a>
          </div>
        </div>

        <div class="nav-group" id="grp-auth">
          <div class="nav-group-btn" onclick="toggleGroup('auth')">
            <svg viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Autenticación
            <svg class="nav-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="nav-submenu">
            <a class="nav-sub-item ${path.includes('autenticacion/registrar') ? 'active' : ''}" href="/frontend/pages/autenticacion/registrar.html">Registro de Funcionarios</a>
            <a class="nav-sub-item ${path.includes('editar-funcionario') ? 'active' : ''}" href="/frontend/pages/autenticacion/editar-funcionario.html">Modificación de Funcionarios</a>
            <a id="navTiposUsuario" class="nav-sub-item ${path.includes('autenticacion/tipos-usuario') ? 'active' : ''}" href="/frontend/pages/autenticacion/tipos-usuario.html">Gestión de Tipos de Usuario</a>
          </div>
        </div>

        <div class="nav-group" id="grp-aprobacion">
          <div class="nav-group-btn" onclick="toggleGroup('aprobacion')">
            <svg viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Aprobación
            <svg class="nav-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="nav-submenu">
            <a class="nav-sub-item ${path.includes('aprobacion_jefatura') ? 'active' : ''}" href="/frontend/pages/aprobacion/aprobacion_jefatura.html">Visualizar Solicitudes</a>
          </div>
        </div>
      </div>

      <div class="nav-right">
        <div class="nav-date" id="navDate"></div>
        <div class="nav-btn">
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <div class="notif-dot"></div>
        </div>
        <div class="action-btn" onclick="toggleTheme()">
          <svg id="themeIcon" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </div>
        <div class="action-btn logout" onclick="logout()">
          <svg viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Salir
        </div>
        <div class="user-wrap" id="userWrap">
          <div class="user-pill" onclick="toggleUserMenu()">
            <div class="avatar" id="navAvatar">?</div>
            <div class="user-pill-text">
              <span class="user-pill-name" id="navName">Usuario</span>
              <span class="user-pill-nom" id="pillNomLabel">—</span>
            </div>
          </div>
          <div class="user-dropdown" id="userDropdown"></div>
        </div>
      </div>
    </nav>
    `;

    this._updateDate();
    setInterval(() => this._updateDate(), 60000);
    this._markActiveGroup();
    this._applyRolUI();

    document.dispatchEvent(new CustomEvent('navbar-ready'));
  }

  _updateDate() {
    const el = this.querySelector('#navDate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  _markActiveGroup() {
    const path = window.location.pathname;
    const grupos = {
      'solicitudes': path.includes('solicitudes'),
      'saldo':       path.includes('saldo'),
      'auth':        path.includes('autenticacion'),
      'aprobacion':  path.includes('aprobacion'),
    };
    for (const [key, isActive] of Object.entries(grupos)) {
      const btn = this.querySelector(`#grp-${key} .nav-group-btn`);
      if (btn && isActive) {
        btn.style.background = 'rgba(125,166,216,0.11)';
        btn.style.color = '#7da6d8';
      }
    }
  }

  _applyRolUI() {
    const funcionario = JSON.parse(localStorage.getItem('funcionario') || '{}');
    const nombre = funcionario.nombre || 'Usuario';
    const rol    = (funcionario.rol   || '').toLowerCase();

    this._applyMenuPermisos(rol);

    // ── Normalizar array de nombramientos ─────────────────────────────────
    // Soporta: array directo, objeto con clave 'data', 'nombramientos', o 'rows'
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem('nombramientos') || 'null'); } catch(e) {}

    let nombramientos = [];
    if (Array.isArray(raw)) {
      nombramientos = raw;
    } else if (raw && typeof raw === 'object') {
      // Si el backend devolvió { data: [...] } o { nombramientos: [...] }
      nombramientos = raw.data || raw.nombramientos || raw.rows || [];
    }

    // ── DEBUG: ver qué hay en localStorage ───────────────────────────────
    console.group('[Navbar] _applyRolUI');
    console.log('funcionario:', funcionario);
    console.log('nombramientos raw:', raw);
    console.log('nombramientos normalizados:', nombramientos);
    console.log('cantidad:', nombramientos.length);
    console.groupEnd();

    // ── Nombre e iniciales ────────────────────────────────────────────────
    const primerNombre = nombre.split(' ')[0];
    const iniciales    = nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

    const navName   = this.querySelector('#navName');
    const navAvatar = this.querySelector('#navAvatar');
    if (navName)   navName.textContent   = primerNombre;
    if (navAvatar) navAvatar.textContent = iniciales || '?';

    const pillNom  = this.querySelector('#pillNomLabel');
    const dropdown = this.querySelector('#userDropdown');
    const pill     = this.querySelector('.user-pill');

    // ── Roles administrativos: sin nombramiento ───────────────────────────
    const ROLES_ADMIN = ['rrhh', 'jefe', 'admin'];
    if (ROLES_ADMIN.includes(rol)) {
      if (pillNom) {
        pillNom.textContent = rol === 'rrhh' ? 'RRHH' : rol.charAt(0).toUpperCase() + rol.slice(1);
        pillNom.style.color = 'rgba(125,166,216,0.45)';
        pillNom.style.letterSpacing = '.1em';
        pillNom.style.textTransform = 'uppercase';
        pillNom.style.fontFamily = '"DM Mono",monospace';
      }
      if (dropdown) dropdown.style.display = 'none';
      if (pill)     pill.style.cursor = 'default';
      if (pill)     pill.onclick = null;
      return;
    }

    // ── Sin nombramientos en sesión ───────────────────────────────────────
    if (!nombramientos || nombramientos.length === 0) {
      const tipoNom = JSON.parse(localStorage.getItem('tipoNombramiento') || '{}');
      if (pillNom) pillNom.textContent = tipoNom.nombre_tipo || '—';
      if (dropdown) dropdown.style.display = 'none';
      if (pill)     pill.style.cursor = 'default';
      return;
    }

    // ── Nombramiento activo: cargar desde localStorage o usar el primero ──
    let idActivo    = parseInt(localStorage.getItem('id_nombramiento_activo') || '0');
    let indexActivo = nombramientos.findIndex(n => (n.id_historial_nombramiento ?? n.id_nombramiento) === idActivo);
    if (indexActivo < 0) indexActivo = 0;

    const nomActivo = nombramientos[indexActivo];
    this._setNomActivo(nomActivo, false);

    // ── Solo 1 nombramiento: sin dropdown ─────────────────────────────────
    if (nombramientos.length === 1) {
      if (dropdown) dropdown.style.display = 'none';
      if (pill)     pill.style.cursor = 'default';
      if (pill)     pill.onclick = null;
      return;
    }

    // ── Más de 1: construir dropdown ──────────────────────────────────────
    console.log('[Navbar] Construyendo dropdown con', nombramientos.length, 'nombramientos');
    this._buildDropdown(nombramientos, indexActivo);
  }

  _applyMenuPermisos(rol) {
    const grpAuth = this.querySelector('#grp-auth');
    const grpAprob = this.querySelector('#grp-aprobacion');
    const linkTipos = this.querySelector('#navTiposUsuario');

    // Autenticación (registro/modificación) solo RRHH o Admin
    if (grpAuth) {
      grpAuth.style.display = (rol === 'rrhh' || rol === 'admin') ? '' : 'none';
    }

    // Gestión de tipos de usuario solo Admin
    if (linkTipos) {
      linkTipos.style.display = (rol === 'admin') ? '' : 'none';
    }

    // Aprobación solo Jefe, RRHH o Admin
    if (grpAprob) {
      grpAprob.style.display = (rol === 'jefe' || rol === 'rrhh' || rol === 'admin') ? '' : 'none';
    }
  }

  /** Actualiza el pill label con el nombramiento dado */
  _setNomActivo(nom, dispatchEvent = true) {
    const pillNom = this.querySelector('#pillNomLabel');

    // Nombre del tipo — admite distintas claves que puedan venir del backend
    const nombreTipo = nom.nombre_tipo
      || nom.nombre_tipo_nombramiento
      || nom.tipo
      || '—';

    if (pillNom) pillNom.textContent = nombreTipo;

    // Guardar en localStorage para que cualquier página pueda leerlo
    localStorage.setItem('tipoNombramiento', JSON.stringify(nom));
    localStorage.setItem('id_nombramiento_activo', (nom.id_historial_nombramiento ?? nom.id_nombramiento ?? '').toString());

    if (dispatchEvent) {
      /**
       * Evento: 'nombramiento-changed'
       * detail: el objeto del nombramiento completo
       * Las páginas (dashboard, saldo, etc.) escuchan este evento
       * y recargan el saldo llamando a su propia API con el nuevo id_nombramiento
       */
      document.dispatchEvent(new CustomEvent('nombramiento-changed', {
        detail: nom,
        bubbles: true
      }));
    }
  }

  /** Construye el HTML del dropdown con todos los nombramientos */
  _buildDropdown(nombramientos, indexActivo) {
    const dropdown = this.querySelector('#userDropdown');
    if (!dropdown) return;

    let html = `<div class="ud-label">Tipo de nombramiento</div>`;

    nombramientos.forEach((nom, i) => {
      const nombreTipo = nom.nombre_tipo
        || nom.nombre_tipo_nombramiento
        || nom.tipo
        || 'Nombramiento';

      // Campos opcionales de contexto
      const categoria    = nom.categoria || nom.tipo_funcionario || '';
      const numNom       = nom.numero_nombramiento ? `Nº ${nom.numero_nombramiento}` : '';
      const esPrueba     = nom.en_periodo_prueba ? '· Período de prueba' : '';
      const subLinea     = [categoria, numNom, esPrueba].filter(Boolean).join('  ');

      html += `
        <div class="ud-pill ${i === indexActivo ? 'active' : ''}"
             data-index="${i}"
             onclick="window._navbarSelectNom(this, event)">
          <span class="ud-pill-name">${nombreTipo}</span>
          ${subLinea ? `<span class="ud-pill-sub">${subLinea}</span>` : ''}
        </div>`;
    });

    dropdown.innerHTML = html;
    dropdown.style.display = '';

    // ── Handler global para selección ────────────────────────────────────
    window._navbarSelectNom = (el, e) => {
      if (e) e.stopPropagation();

      const idx           = parseInt(el.dataset.index);
      const nombramientos = JSON.parse(localStorage.getItem('nombramientos') || '[]');
      const nomSeleccionado = nombramientos[idx];
      if (!nomSeleccionado) return;

      // Marcar activo visualmente en el dropdown
      this.querySelectorAll('.ud-pill').forEach(p => p.classList.remove('active'));
      el.classList.add('active');

      // Actualizar pill + localStorage + disparar evento
      this._setNomActivo(nomSeleccionado, true);

      // Cerrar dropdown
      const wrap = document.getElementById('userWrap');
      if (wrap) wrap.classList.remove('open');
    };
  }
}

customElements.define('app-navbar', AppNavbar);

// ── toggleGroup ───────────────────────────────────────────────────────────────
function toggleGroup(id) {
  document.querySelectorAll('.nav-group').forEach(g => {
    if (g.id !== 'grp-' + id) g.classList.remove('open');
  });
  const grp = document.getElementById('grp-' + id);
  if (grp) grp.classList.toggle('open');
  const userWrap = document.getElementById('userWrap');
  if (userWrap) userWrap.classList.remove('open');
}

// ── toggleUserMenu ────────────────────────────────────────────────────────────
function toggleUserMenu() {
  document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
  const wrap = document.getElementById('userWrap');
  if (wrap) wrap.classList.toggle('open');
}

// ── Cerrar al hacer click fuera ───────────────────────────────────────────────
document.addEventListener('click', function(e) {
  if (!e.target.closest('.nav-group')) {
    document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
  }
  if (!e.target.closest('.user-wrap')) {
    const wrap = document.getElementById('userWrap');
    if (wrap) wrap.classList.remove('open');
  }
});
