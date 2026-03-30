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
        .user-dropdown{position:absolute;top:calc(100% + 7px);right:0;min-width:210px;background:rgba(0,31,82,0.97);backdrop-filter:blur(16px);border:1px solid rgba(125,166,216,0.1);border-radius:14px;padding:12px;box-shadow:0 12px 32px rgba(0,0,0,0.28);z-index:300;opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .18s,transform .18s}
        .user-wrap.open .user-dropdown{opacity:1;transform:translateY(0);pointer-events:all}
        .ud-label{font-size:8px;font-weight:400;letter-spacing:.2em;text-transform:uppercase;color:rgba(125,166,216,0.3);margin-bottom:8px;padding:0 4px;font-family:'DM Mono',monospace}
        .ud-pill{display:flex;flex-direction:column;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,0.03);border:1px solid transparent;cursor:pointer;transition:all .2s;margin-bottom:4px}
        .ud-pill:last-child{margin-bottom:0}
        .ud-pill:hover{background:rgba(125,166,216,0.08)}
        .ud-pill.active{background:rgba(26,91,168,0.15);border-color:rgba(125,166,216,0.18)}
        .ud-pill-name{font-size:11.5px;font-weight:300;color:rgba(204,220,240,0.55)}
        .ud-pill.active .ud-pill-name{color:#7da6d8}
        .ud-pill-sub{font-size:9px;font-weight:300;color:rgba(125,166,216,0.28);margin-top:1px}
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
            <div class="avatar" id="navAvatar">Y</div>
            <div class="user-pill-text">
              <span class="user-pill-name" id="navName">Yuliana</span>
              <span class="user-pill-nom" id="pillNomLabel">Propiedad</span>
            </div>
          </div>
          <div class="user-dropdown">
            <div class="ud-label">Nombramiento</div>
            <div class="ud-pill active" data-nom="propiedad" onclick="selectNomFromPill(this)">
              <span class="ud-pill-name">Propiedad</span>
              <span class="ud-pill-sub">Administrativo</span>
            </div>
            <div class="ud-pill" data-nom="interino" onclick="selectNomFromPill(this)">
              <span class="ud-pill-name">Interino</span>
              <span class="ud-pill-sub">Docente</span>
            </div>
            <div class="ud-pill" data-nom="interino_adm" onclick="selectNomFromPill(this)">
              <span class="ud-pill-name">Interino</span>
              <span class="ud-pill-sub">Administrativo</span>
            </div>
            <div class="ud-pill" data-nom="propiedad_doc" onclick="selectNomFromPill(this)">
              <span class="ud-pill-name">Propiedad</span>
              <span class="ud-pill-sub">Docente</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
    `;

    this._updateDate();
    setInterval(() => this._updateDate(), 60000);
    this._markActiveGroup();

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
        btn.style.color = 'var(--g300)';
      }
    }
  }
}

customElements.define('app-navbar', AppNavbar);

// ── toggleGroup: llamado desde onclick="toggleGroup('id')" en cada página ──
function toggleGroup(id) {
  document.querySelectorAll('.nav-group').forEach(g => {
    if (g.id !== 'grp-' + id) g.classList.remove('open');
  });
  const grp = document.getElementById('grp-' + id);
  if (grp) grp.classList.toggle('open');
  const userWrap = document.getElementById('userWrap');
  if (userWrap) userWrap.classList.remove('open');
}

// ── toggleUserMenu: llamado desde onclick="toggleUserMenu()" ──
function toggleUserMenu() {
  document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
  const wrap = document.getElementById('userWrap');
  if (wrap) wrap.classList.toggle('open');
}

// ── Cerrar al hacer click fuera ──
document.addEventListener('click', function(e) {
  if (!e.target.closest('.nav-group')) {
    document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
  }
  if (!e.target.closest('.user-wrap')) {
    const wrap = document.getElementById('userWrap');
    if (wrap) wrap.classList.remove('open');
  }
});