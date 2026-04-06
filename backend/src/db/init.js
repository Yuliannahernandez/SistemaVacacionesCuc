// backend/src/db/init.js
'use strict';

async function initSecurityTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auditoria_tipos_usuario (
      id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
      id_usuario_modificado INT NOT NULL,
      tipo_anterior VARCHAR(32) NOT NULL,
      tipo_nuevo VARCHAR(32) NOT NULL,
      id_admin INT NOT NULL,
      admin_usuario VARCHAR(100) NULL,
      ip_address VARCHAR(64) NULL,
      fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tipo_usuario_confirmaciones (
      id_confirmacion VARCHAR(64) PRIMARY KEY,
      id_usuario_objetivo INT NOT NULL,
      tipo_nuevo VARCHAR(32) NOT NULL,
      id_admin_solicitante INT NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expira_en TIMESTAMP NOT NULL,
      usado TINYINT(1) NOT NULL DEFAULT 0,
      confirmado_por INT NULL,
      confirmado_en TIMESTAMP NULL
    )
  `);
}

module.exports = { initSecurityTables };

