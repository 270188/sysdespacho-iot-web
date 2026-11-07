// Crea la cuenta propietaria de n8n con OWNER_EMAIL y OWNER_PASSWORD (variables de entorno).
const port = process.env.N8N_PORT || 5678;
const email = process.env.OWNER_EMAIL, password = process.env.OWNER_PASSWORD;
if (!email || !password) { console.log('[owner] Sin OWNER_EMAIL/OWNER_PASSWORD: la cuenta se crea desde el navegador.'); process.exit(0); }
const base = `http://127.0.0.1:${port}`;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${base}/healthz`); if (r.ok) break; } catch {}
    await espera(2000);
  }
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/rest/owner/setup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName: 'Bot', lastName: 'SysDespacho' }),
      });
      if (r.status !== 404) { console.log('[owner] Configuración de cuenta:', r.status, r.ok ? 'creada' : (await r.text()).slice(0, 200)); return; }
    } catch (e) { console.log('[owner] Error:', e.message); }
    await espera(3000);
  }
  console.log('[owner] No se pudo crear la cuenta automáticamente; créela desde el navegador.');
})();
