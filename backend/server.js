const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const db = require("./src/routes/controllers/db");

db.query("SELECT 1")
  .then(() => console.log(" Conectado a MySQL Aiven"))
  .catch((err) => console.error(" Error de conexión:", err.message));

app.get("/", (req, res) => {
  res.json({ mensaje: "API funcionando correctamente" });
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});