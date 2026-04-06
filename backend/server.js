const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ── Middlewares PRIMERO ───────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token']
}));
app.use(express.json());  // ← esto debe ir antes del static

// ── Frontend estático ─────────────────────────────────────────────────────
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

app.get("/", (req, res) => {
  res.redirect('/frontend/pages/autenticacion/login.html');
});

// ── DB ────────────────────────────────────────────────────────────────────
const db = require("./src/routes/controllers/db");
db.query("SELECT 1")
  .then(() => console.log(" Conectado a MySQL Aiven"))
  .catch((err) => console.error(" Error de conexión:", err.message));

// ── Init tablas de seguridad (auditoría / confirmaciones) ───────────────────
const { initSecurityTables } = require('./src/db/init');
initSecurityTables(db)
  .then(() => console.log(' Tablas de seguridad verificadas'))
  .catch((err) => console.warn(' Aviso: no se pudieron inicializar tablas de seguridad:', err.message));

// ── Rutas API ─────────────────────────────────────────────────────────────
const autenticacionRoutes = require('./src/routes/autenticacion.routes');
app.use('/api/auth', autenticacionRoutes);

const saldoRoutes = require('./src/routes/saldo.routes');
app.use('/api/saldo', saldoRoutes);

const solicitudesRoutes = require('./src/routes/solicitudes.routes');
app.use('/api/solicitudes', solicitudesRoutes);

const aprobacionRoutes = require('./src/routes/aprobacion.routes');
app.use('/api/aprobacion', aprobacionRoutes);

const registroRoutes = require('./src/routes/registro-funcionario.routes');
app.use('/api/registro', registroRoutes);

const catalogosRoutes = require('./src/routes/catalogos.routes');
app.use('/api/catalogos', catalogosRoutes);

const usuariosRoutes = require('./src/routes/usuarios.routes');
app.use('/api/usuarios', usuariosRoutes);



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
