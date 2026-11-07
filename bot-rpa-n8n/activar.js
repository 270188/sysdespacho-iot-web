// Activa el chat del asistente y el enlace de descarga directamente en la base SQLite de n8n (más rápido que la CLI).
const path = '/home/node/.n8n/database.sqlite';
let sqlite3;
try { sqlite3 = require(require.resolve('sqlite3', { paths: ['/usr/local/lib/node_modules/n8n'] })); }
catch (e) { console.log('[activar] sqlite3 no disponible:', e.message); process.exit(1); }
const db = new sqlite3.Database(path);
db.run("UPDATE workflow_entity SET active = 1 WHERE id IN ('SysDespachoAsistente', 'SysDespachoDescarga')", function (err) {
  if (err) { console.log('[activar] Error:', err.message); process.exit(1); }
  console.log('[activar] Flujos activados:', this.changes);
  db.close();
});
